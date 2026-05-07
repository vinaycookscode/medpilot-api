import { Entity, Column, ManyToOne, JoinColumn, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';

@Entity('prescriptions')
export class Prescription extends BaseEntity {
  @Column()
  clinicId: string;

  @Column({ nullable: true })
  appointmentId: string;

  @Column()
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column()
  doctorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'doctorId' })
  doctor: User;

  @Column({ type: 'text' })
  diagnosis: string;

  @Column({ nullable: true, type: 'text' })
  chiefComplaint: string;

  @Column({ nullable: true, type: 'text' })
  examinationNotes: string;

  @Column({ nullable: true, type: 'text' })
  advice: string;

  @Column({ type: 'date', nullable: true })
  followUpDate: Date | null;

  @Column({ nullable: true, type: 'text' })
  followUpNotes: string;

  @Column({ type: 'jsonb', default: {} })
  vitalsSnapshot: Record<string, unknown>;

  @Column({ nullable: true })
  pdfUrl: string;

  @Column({ type: 'timestamptz', nullable: true })
  pdfGeneratedAt: Date | null;

  @OneToMany(() => PrescriptionMedicine, (m) => m.prescription, { cascade: true, eager: true })
  medicines: PrescriptionMedicine[];

  @OneToMany(() => PrescriptionTest, (t) => t.prescription, { cascade: true, eager: true })
  tests: PrescriptionTest[];
}

@Entity('prescription_medicines')
export class PrescriptionMedicine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  prescriptionId: string;

  @ManyToOne(() => Prescription, (p) => p.medicines)
  @JoinColumn({ name: 'prescriptionId' })
  prescription: Prescription;

  @Column({ nullable: true })
  medicineId: string;

  @Column({ length: 255 })
  medicineName: string;

  @Column({ length: 100 })
  dosage: string;

  @Column({ length: 100 })
  frequency: string;

  @Column({ length: 100 })
  duration: string;

  @Column({ nullable: true, length: 100 })
  timing: string;

  @Column({ nullable: true, type: 'text' })
  instructions: string;

  @Column({ nullable: true })
  quantity: number;

  @Column({ default: 0 })
  sortOrder: number;
}

@Entity('prescription_tests')
export class PrescriptionTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  prescriptionId: string;

  @ManyToOne(() => Prescription, (p) => p.tests)
  @JoinColumn({ name: 'prescriptionId' })
  prescription: Prescription;

  @Column({ length: 255 })
  testName: string;

  @Column({ nullable: true, type: 'text' })
  instructions: string;

  @Column({ default: 0 })
  sortOrder: number;
}
