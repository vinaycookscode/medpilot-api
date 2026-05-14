import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsuranceProvider } from './entities/insurance-provider.entity';
import { InsuranceClaim, ClaimStatus } from './entities/insurance-claim.entity';
import { CreateProviderDto } from './dto/create-provider.dto';
import { CreateClaimDto } from './dto/create-claim.dto';
import { UpdateClaimDto } from './dto/update-claim.dto';
import { QueryClaimsDto } from './dto/query-claims.dto';

const SUBMITTED_STATUSES = new Set<ClaimStatus>([
  ClaimStatus.SUBMITTED,
  ClaimStatus.UNDER_REVIEW,
  ClaimStatus.APPROVED,
  ClaimStatus.PARTIALLY_APPROVED,
  ClaimStatus.REJECTED,
  ClaimStatus.PAID,
]);

const SETTLED_STATUSES = new Set<ClaimStatus>([
  ClaimStatus.APPROVED,
  ClaimStatus.PARTIALLY_APPROVED,
  ClaimStatus.PAID,
]);

@Injectable()
export class InsuranceService {
  constructor(
    @InjectRepository(InsuranceProvider) private providersRepo: Repository<InsuranceProvider>,
    @InjectRepository(InsuranceClaim) private claimsRepo: Repository<InsuranceClaim>,
  ) {}

  async createProvider(clinicId: string, dto: CreateProviderDto): Promise<InsuranceProvider> {
    const provider = this.providersRepo.create({ ...dto, clinicId });
    return this.providersRepo.save(provider);
  }

  async findProviders(clinicId: string): Promise<InsuranceProvider[]> {
    return this.providersRepo.find({
      where: { clinicId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async createClaim(clinicId: string, dto: CreateClaimDto): Promise<InsuranceClaim> {
    const claim = this.claimsRepo.create({
      ...dto,
      clinicId,
      invoiceId: dto.invoiceId ?? null,
      status: ClaimStatus.DRAFT,
    });
    const saved = await this.claimsRepo.save(claim);
    return this.findClaimById(saved.id, clinicId);
  }

  async findClaims(clinicId: string, query: QueryClaimsDto) {
    const qb = this.claimsRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.patient', 'patient')
      .leftJoinAndSelect('c.provider', 'provider')
      .leftJoinAndSelect('c.invoice', 'invoice')
      .where('c.clinicId = :clinicId', { clinicId })
      .andWhere('c.deletedAt IS NULL');

    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }
    if (query.providerId) {
      qb.andWhere('c.providerId = :providerId', { providerId: query.providerId });
    }
    if (query.patientId) {
      qb.andWhere('c.patientId = :patientId', { patientId: query.patientId });
    }
    if (query.from) {
      qb.andWhere('c.createdAt >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('c.createdAt <= :to', { to: query.to });
    }

    const sortableColumns: Record<string, string> = {
      createdAt: 'c.createdAt', claimAmount: 'c.claimAmount',
      approvedAmount: 'c.approvedAmount', status: 'c.status', policyNumber: 'c.policyNumber',
    };
    const sortField = (query.sortBy && sortableColumns[query.sortBy]) ? sortableColumns[query.sortBy] : 'c.createdAt';
    qb.orderBy(sortField, query.sortOrder === 'ASC' ? 'ASC' : 'DESC');

    const [data, total] = await qb.skip(query.skip).take(query.limit).getManyAndCount();

    return { data, meta: { total, page: query.page, limit: query.limit } };
  }

  async findClaimById(id: string, clinicId: string): Promise<InsuranceClaim> {
    const claim = await this.claimsRepo.findOne({
      where: { id, clinicId },
      relations: ['patient', 'provider', 'invoice'],
    });
    if (!claim) throw new NotFoundException('Insurance claim not found');
    return claim;
  }

  async updateClaim(id: string, clinicId: string, dto: UpdateClaimDto): Promise<InsuranceClaim> {
    const claim = await this.findClaimById(id, clinicId);

    const wasSubmitted = SUBMITTED_STATUSES.has(claim.status);
    const willBeSubmitted = SUBMITTED_STATUSES.has(dto.status);

    if (!wasSubmitted && willBeSubmitted) {
      claim.submittedAt = new Date();
    }

    const wasSettled = SETTLED_STATUSES.has(claim.status);
    const willBeSettled = SETTLED_STATUSES.has(dto.status);

    if (!wasSettled && willBeSettled) {
      claim.settledAt = new Date();
    }

    claim.status = dto.status;
    if (dto.approvedAmount !== undefined) claim.approvedAmount = dto.approvedAmount;
    if (dto.rejectionReason !== undefined) claim.rejectionReason = dto.rejectionReason;
    if (dto.notes !== undefined) claim.notes = dto.notes;

    await this.claimsRepo.save(claim);
    return this.findClaimById(id, clinicId);
  }

  async getClaimStats(clinicId: string) {
    const stats = await this.claimsRepo
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(c.claimAmount)', 'totalClaimAmount')
      .addSelect('SUM(c.approvedAmount)', 'totalApprovedAmount')
      .where('c.clinicId = :clinicId AND c.deletedAt IS NULL', { clinicId })
      .groupBy('c.status')
      .getRawMany();

    const byStatus: Record<string, { count: number; totalClaimAmount: number }> = {};
    let totalPending = 0;
    let totalApproved = 0;

    for (const row of stats) {
      byStatus[row.status] = {
        count: Number(row.count),
        totalClaimAmount: Number(row.totalClaimAmount ?? 0),
      };

      if (
        row.status === ClaimStatus.SUBMITTED ||
        row.status === ClaimStatus.UNDER_REVIEW ||
        row.status === ClaimStatus.DRAFT
      ) {
        totalPending += Number(row.totalClaimAmount ?? 0);
      }

      if (
        row.status === ClaimStatus.APPROVED ||
        row.status === ClaimStatus.PARTIALLY_APPROVED ||
        row.status === ClaimStatus.PAID
      ) {
        totalApproved += Number(row.totalApprovedAmount ?? 0);
      }
    }

    return { byStatus, totalPending, totalApproved };
  }
}
