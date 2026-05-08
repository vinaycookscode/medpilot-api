import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from './entities/clinic.entity';
import { Branch } from './entities/branch.entity';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { CreateBranchDto } from './dto/create-branch.dto';

@Injectable()
export class ClinicsService {
  constructor(
    @InjectRepository(Clinic) private clinicsRepo: Repository<Clinic>,
    @InjectRepository(Branch) private branchesRepo: Repository<Branch>,
  ) {}

  async create(dto: CreateClinicDto): Promise<Clinic> {
    const existing = await this.clinicsRepo.findOne({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Clinic slug already exists');

    const clinic = this.clinicsRepo.create(dto);
    return this.clinicsRepo.save(clinic);
  }

  async findById(id: string): Promise<Clinic> {
    const clinic = await this.clinicsRepo.findOne({ where: { id } });
    if (!clinic) throw new NotFoundException('Clinic not found');
    return clinic;
  }

  async findBySlug(slug: string): Promise<Clinic> {
    const clinic = await this.clinicsRepo.findOne({ where: { slug } });
    if (!clinic) throw new NotFoundException('Clinic not found');
    return clinic;
  }

  async update(id: string, dto: UpdateClinicDto): Promise<Clinic> {
    const clinic = await this.findById(id);
    Object.assign(clinic, dto);
    return this.clinicsRepo.save(clinic);
  }

  async updateSettings(id: string, settings: Record<string, unknown>): Promise<Clinic> {
    const clinic = await this.findById(id);
    clinic.settings = { ...clinic.settings, ...settings };
    return this.clinicsRepo.save(clinic);
  }

  // ── Branches ──────────────────────────────────────────────────

  async getBranches(clinicId: string): Promise<Branch[]> {
    return this.branchesRepo.find({
      where: { clinicId, isActive: true },
      order: { isHeadOffice: 'DESC', name: 'ASC' },
    });
  }

  async createBranch(clinicId: string, dto: CreateBranchDto): Promise<Branch> {
    const branch = this.branchesRepo.create({ ...dto, clinicId });
    return this.branchesRepo.save(branch);
  }

  async updateBranch(id: string, clinicId: string, dto: Partial<CreateBranchDto>): Promise<Branch> {
    const branch = await this.branchesRepo.findOne({ where: { id, clinicId } });
    if (!branch) throw new NotFoundException('Branch not found');
    Object.assign(branch, dto);
    return this.branchesRepo.save(branch);
  }

  async deleteBranch(id: string, clinicId: string): Promise<void> {
    const branch = await this.branchesRepo.findOne({ where: { id, clinicId } });
    if (!branch) throw new NotFoundException('Branch not found');
    branch.isActive = false;
    await this.branchesRepo.save(branch);
  }
}
