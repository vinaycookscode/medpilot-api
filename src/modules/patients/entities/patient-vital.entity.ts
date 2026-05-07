import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Patient } from './patient.entity';
import { User } from '../../users/entities/user.entity';

export enum VitalType {
  BLOOD_PRESSURE = 'blood_pressure',
  HEART_RATE = 'heart_rate',
  TEMPERATURE = 'temperature',
  WEIGHT = 'weight',
  HEIGHT = 'height',
  SPO2 = 'spo2',
  BLOOD_GLUCOSE = 'blood_glucose',
  BMI = 'bmi',
}

@Entity('patient_vitals')
export class PatientVital extends BaseEntity {
  @Column()
  clinicId: string;

  @Column()
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ nullable: true })
  appointmentId: string;

  @Column({ nullable: true })
  recordedBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'recordedBy' })
  recordedByUser: User;

  @Column({ type: 'enum', enum: VitalType })
  vitalType: VitalType;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  value: number;

  @Column({ length: 20 })
  unit: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  recordedAt: Date;
}
