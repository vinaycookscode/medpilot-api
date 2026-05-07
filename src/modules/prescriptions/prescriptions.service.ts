import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, LessThan, Between, MoreThanOrEqual } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Prescription, PrescriptionMedicine, PrescriptionTest } from './entities/prescription.entity';
import { Medicine } from './entities/medicine.entity';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { PrescriptionQueryDto } from './dto/prescription-query.dto';
import { UserRole } from '../users/enums/user-role.enum';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class PrescriptionsService {
  constructor(
    @InjectRepository(Prescription) private rxRepo: Repository<Prescription>,
    @InjectRepository(PrescriptionMedicine) private rxMedRepo: Repository<PrescriptionMedicine>,
    @InjectRepository(PrescriptionTest) private rxTestRepo: Repository<PrescriptionTest>,
    @InjectRepository(Medicine) private medicinesRepo: Repository<Medicine>,
  ) {}

  async create(clinicId: string, doctorId: string, dto: CreatePrescriptionDto): Promise<Prescription> {
    const rx = this.rxRepo.create({
      id: uuidv4(),
      ...dto,
      clinicId,
      doctorId,
      medicines: (dto.medicines ?? []).map((m, i) => ({
        ...m,
        id: uuidv4(),
        sortOrder: i,
      })) as PrescriptionMedicine[],
      tests: (dto.tests ?? []).map((t, i) => ({
        ...t,
        id: uuidv4(),
        sortOrder: i,
      })) as PrescriptionTest[],
    });
    return this.rxRepo.save(rx);
  }

  async findAll(clinicId: string, query: PrescriptionQueryDto, currentUser: JwtPayload) {
    const qb = this.rxRepo
      .createQueryBuilder('rx')
      .leftJoinAndSelect('rx.patient', 'patient')
      .leftJoinAndSelect('rx.doctor', 'doctor')
      .leftJoinAndSelect('rx.medicines', 'medicines')
      .leftJoinAndSelect('rx.tests', 'tests')
      .where('rx.clinicId = :clinicId', { clinicId })
      .andWhere('rx.deletedAt IS NULL');

    if (currentUser.role === UserRole.DOCTOR) {
      qb.andWhere('rx.doctorId = :doctorId', { doctorId: currentUser.sub });
    }

    if (query.patientId) {
      qb.andWhere('rx.patientId = :patientId', { patientId: query.patientId });
    }

    qb.orderBy('rx.createdAt', 'DESC');
    const total = await qb.getCount();
    const data = await qb.skip(query.skip).take(query.limit).getMany();

    return { data, meta: { total, page: query.page, limit: query.limit } };
  }

  async findById(id: string, clinicId: string): Promise<Prescription> {
    const rx = await this.rxRepo.findOne({
      where: { id, clinicId },
      relations: ['patient', 'doctor', 'medicines', 'tests'],
    });
    if (!rx) throw new NotFoundException('Prescription not found');
    return rx;
  }

  async update(
    id: string,
    clinicId: string,
    dto: Partial<CreatePrescriptionDto>,
    currentUser: JwtPayload,
  ): Promise<Prescription> {
    const rx = await this.findById(id, clinicId);

    if (currentUser.role === UserRole.DOCTOR && rx.doctorId !== currentUser.sub) {
      throw new ForbiddenException('Cannot edit another doctor\'s prescription');
    }

    const sameDay =
      new Date(rx.createdAt).toDateString() === new Date().toDateString();
    if (!sameDay && currentUser.role === UserRole.DOCTOR) {
      throw new ForbiddenException('Prescription can only be edited on the same day');
    }

    Object.assign(rx, dto);
    return this.rxRepo.save(rx);
  }

  async getPatientPrescriptions(patientId: string, clinicId: string): Promise<Prescription[]> {
    return this.rxRepo.find({
      where: { patientId, clinicId },
      relations: ['doctor', 'medicines', 'tests'],
      order: { createdAt: 'DESC' },
    });
  }

  async searchMedicines(search: string, clinicId: string): Promise<Medicine[]> {
    return this.medicinesRepo
      .createQueryBuilder('m')
      .where('(m.clinicId = :clinicId OR m.clinicId IS NULL)', { clinicId })
      .andWhere('(m.name ILIKE :s OR m.genericName ILIKE :s)', { s: `%${search}%` })
      .andWhere('m.isActive = true')
      .orderBy('m.clinicId', 'DESC')
      .limit(20)
      .getMany();
  }

  async suggestDiagnoses(q: string, clinicId: string): Promise<string[]> {
    const common = [
      'Upper Respiratory Tract Infection (URTI)', 'Lower Respiratory Tract Infection (LRTI)',
      'Acute Gastritis', 'Acute Gastroenteritis', 'Peptic Ulcer Disease',
      'Irritable Bowel Syndrome (IBS)', 'Gastroesophageal Reflux Disease (GERD)',
      'Type 2 Diabetes Mellitus', 'Type 1 Diabetes Mellitus', 'Diabetic Ketoacidosis',
      'Hypertension (Essential)', 'Hypertensive Urgency',
      'Bronchial Asthma', 'Chronic Obstructive Pulmonary Disease (COPD)',
      'Acute Bronchitis', 'Pneumonia', 'Tuberculosis (PTB)',
      'Allergic Rhinitis', 'Sinusitis', 'Pharyngitis', 'Tonsillitis',
      'Otitis Media', 'Conjunctivitis',
      'Urinary Tract Infection (UTI)', 'Pyelonephritis',
      'Anaemia (Iron Deficiency)', 'Vitamin D Deficiency', 'Hypothyroidism', 'Hyperthyroidism',
      'Migraine', 'Tension Headache', 'Vertigo',
      'Acute Fever (Pyrexia of Unknown Origin)', 'Dengue Fever', 'Malaria', 'Typhoid Fever',
      'Chickenpox (Varicella)', 'Herpes Zoster',
      'Cellulitis', 'Furuncle', 'Wound Infection',
      'Osteoarthritis', 'Rheumatoid Arthritis', 'Gout',
      'Low Back Pain', 'Cervical Spondylosis',
      'Anxiety Disorder', 'Depression', 'Insomnia',
      'Acute Coronary Syndrome', 'Heart Failure', 'Atrial Fibrillation',
      'Dyslipidaemia', 'Obesity', 'Metabolic Syndrome',
    ].filter(d => d.toLowerCase().includes(q.toLowerCase()));

    const dbRows: { diagnosis: string }[] = await this.rxRepo
      .createQueryBuilder('rx')
      .select('DISTINCT rx.diagnosis', 'diagnosis')
      .where('rx.clinicId = :clinicId', { clinicId })
      .andWhere('rx.diagnosis ILIKE :q', { q: `%${q}%` })
      .orderBy('rx.diagnosis')
      .limit(10)
      .getRawMany();

    const dbDiagnoses = dbRows.map(r => r.diagnosis);
    const merged = [...new Set([...dbDiagnoses, ...common])];
    return merged.slice(0, 15);
  }

  async getFollowups(clinicId: string, days = 60): Promise<{
    overdue: Prescription[];
    today: Prescription[];
    upcoming: Prescription[];
  }> {
    const todayStr = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const base = {
      clinicId,
      deletedAt: null as any,
    };

    const [overdueRaw, todayRaw, upcomingRaw] = await Promise.all([
      this.rxRepo.find({
        where: { ...base, followUpDate: LessThan(todayStr) as any },
        relations: ['patient', 'doctor'],
        order: { followUpDate: 'ASC' },
      }),
      this.rxRepo.find({
        where: { ...base, followUpDate: todayStr as any },
        relations: ['patient', 'doctor'],
        order: { createdAt: 'DESC' },
      }),
      this.rxRepo.find({
        where: { ...base, followUpDate: Between(
          new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0] as any,
          futureDateStr as any,
        ) },
        relations: ['patient', 'doctor'],
        order: { followUpDate: 'ASC' },
      }),
    ]);

    return { overdue: overdueRaw, today: todayRaw, upcoming: upcomingRaw };
  }

  async suggestTests(q: string, clinicId: string): Promise<string[]> {
    const common = [
      'CBC (Complete Blood Count)', 'CBC with Differential',
      'Blood Sugar — Fasting', 'Blood Sugar — Post-Prandial', 'HbA1c',
      'Lipid Profile', 'LFT (Liver Function Test)', 'KFT (Kidney Function Test)',
      'Thyroid Profile (TSH, T3, T4)', 'TSH', 'Free T3 / Free T4',
      'Urine Routine & Microscopy', 'Urine Culture & Sensitivity', 'Urine Microalbumin',
      'Serum Electrolytes (Na, K, Cl)', 'Serum Creatinine', 'Blood Urea',
      'Serum Uric Acid', 'Serum Calcium', 'Serum Phosphorus', 'Vitamin D (25-OH)',
      'Vitamin B12', 'Serum Ferritin', 'Serum Iron & TIBC',
      'ESR (Erythrocyte Sedimentation Rate)', 'CRP (C-Reactive Protein)',
      'RA Factor', 'ANA (Anti-Nuclear Antibody)',
      'Dengue NS1 Antigen', 'Dengue IgM / IgG', 'Malaria Antigen Test', 'Widal Test',
      'HIV ELISA', 'HBsAg', 'HCV Antibody', 'VDRL',
      'Chest X-Ray (PA view)', 'ECG (12-lead)', 'Echo-Cardiography',
      'Ultrasonography — Abdomen & Pelvis', 'CT Scan — Chest',
      'Peak Flow Rate (PEFR)', 'Spirometry',
      'Throat Swab C&S', 'Sputum AFB Smear', 'Mantoux Test',
      'Stool Routine & Microscopy', 'H. Pylori Antigen (Stool)',
      'Pap Smear', 'Mammography',
    ].filter(t => t.toLowerCase().includes(q.toLowerCase()));

    const dbRows: { testName: string }[] = await this.rxTestRepo
      .createQueryBuilder('t')
      .select('DISTINCT t.testName', 'testName')
      .innerJoin('t.prescription', 'rx')
      .where('rx.clinicId = :clinicId', { clinicId })
      .andWhere('t.testName ILIKE :q', { q: `%${q}%` })
      .orderBy('t.testName')
      .limit(10)
      .getRawMany();

    const dbTests = dbRows.map(r => r.testName);
    const merged = [...new Set([...dbTests, ...common])];
    return merged.slice(0, 15);
  }
}
