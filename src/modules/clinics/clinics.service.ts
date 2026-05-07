import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from './entities/clinic.entity';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';

@Injectable()
export class ClinicsService {
  constructor(
    @InjectRepository(Clinic) private clinicsRepo: Repository<Clinic>,
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
}
