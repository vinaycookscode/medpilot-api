import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { PatientVital } from './entities/patient-vital.entity';
import { PatientDocument } from './entities/patient-document.entity';
import { CreatePatientDto } from './dto/create-patient.dto';
import { PatientQueryDto } from './dto/patient-query.dto';
import { AddVitalDto } from './dto/add-vital.dto';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient) private patientsRepo: Repository<Patient>,
    @InjectRepository(PatientVital) private vitalsRepo: Repository<PatientVital>,
    @InjectRepository(PatientDocument) private documentsRepo: Repository<PatientDocument>,
  ) {}

  async create(clinicId: string, dto: CreatePatientDto, createdBy: string): Promise<Patient> {
    const existing = await this.patientsRepo.findOne({
      where: { clinicId, phone: dto.phone },
    });
    if (existing) throw new ConflictException('Patient with this phone already registered');

    const patientCode = await this.generatePatientCode(clinicId);

    const patient = this.patientsRepo.create({
      ...dto,
      clinicId,
      patientCode,
      createdBy,
    });
    return this.patientsRepo.save(patient);
  }

  async findAll(clinicId: string, query: PatientQueryDto) {
    const qb = this.patientsRepo
      .createQueryBuilder('p')
      .where('p.clinicId = :clinicId', { clinicId })
      .andWhere('p.deletedAt IS NULL');

    if (query.search) {
      qb.andWhere(
        `(p.firstName ILIKE :s OR p.lastName ILIKE :s OR p.phone ILIKE :s OR p.patientCode ILIKE :s
          OR CONCAT(p.firstName, ' ', p.lastName) ILIKE :s)`,
        { s: `%${query.search}%` },
      );
    }

    if (query.gender) qb.andWhere('p.gender = :gender', { gender: query.gender });
    if (query.isActive !== undefined) qb.andWhere('p.isActive = :isActive', { isActive: query.isActive });

    const sortField = query.sortBy ? `p.${query.sortBy}` : 'p.createdAt';
    qb.orderBy(sortField, query.sortOrder ?? 'DESC');

    const [data, total] = await qb.skip(query.skip).take(query.limit).getManyAndCount();

    return { data, meta: { total, page: query.page, limit: query.limit } };
  }

  async findById(id: string, clinicId: string): Promise<Patient> {
    const patient = await this.patientsRepo.findOne({ where: { id, clinicId } });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async update(id: string, clinicId: string, dto: Partial<CreatePatientDto>): Promise<Patient> {
    const patient = await this.findById(id, clinicId);
    Object.assign(patient, dto);
    return this.patientsRepo.save(patient);
  }

  async softDelete(id: string, clinicId: string): Promise<void> {
    await this.findById(id, clinicId);
    await this.patientsRepo.softDelete(id);
  }

  async addVital(
    patientId: string,
    clinicId: string,
    dto: AddVitalDto,
    recordedBy: string,
  ): Promise<PatientVital> {
    await this.findById(patientId, clinicId);
    const vital = this.vitalsRepo.create({
      ...dto,
      patientId,
      clinicId,
      recordedBy,
    });
    return this.vitalsRepo.save(vital);
  }

  async getVitals(patientId: string, clinicId: string): Promise<PatientVital[]> {
    await this.findById(patientId, clinicId);
    return this.vitalsRepo.find({
      where: { patientId },
      order: { recordedAt: 'DESC' },
    });
  }

  async getDocuments(patientId: string, clinicId: string): Promise<PatientDocument[]> {
    await this.findById(patientId, clinicId);
    return this.documentsRepo.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async addDocument(
    patientId: string,
    clinicId: string,
    documentData: Partial<PatientDocument>,
    uploadedBy: string,
  ): Promise<PatientDocument> {
    await this.findById(patientId, clinicId);
    const doc = this.documentsRepo.create({
      ...documentData,
      patientId,
      clinicId,
      uploadedBy,
    });
    return this.documentsRepo.save(doc);
  }

  async deleteDocument(docId: string, clinicId: string): Promise<void> {
    const doc = await this.documentsRepo.findOne({ where: { id: docId, clinicId } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.documentsRepo.softDelete(docId);
  }

  private async generatePatientCode(clinicId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.patientsRepo.count({ where: { clinicId } });
    const seq = String(count + 1).padStart(5, '0');
    return `P-${year}-${seq}`;
  }
}
