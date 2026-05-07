import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

export enum AppointmentType {
  NEW_PATIENT = 'new_patient',
  FOLLOW_UP = 'follow_up',
  EMERGENCY = 'emergency',
  ROUTINE = 'routine',
}

@Entity('appointments')
@Index(['clinicId', 'appointmentDate', 'doctorId'])
@Index(['clinicId', 'patientId'])
export class Appointment extends BaseEntity {
  @Column()
  clinicId: string;

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

  @Column({ nullable: true })
  bookedBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'bookedBy' })
  bookedByUser: User;

  @Column({ type: 'date' })
  appointmentDate: Date;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  @Column({ default: 20 })
  durationMinutes: number;

  @Column({ type: 'enum', enum: AppointmentStatus, default: AppointmentStatus.SCHEDULED })
  status: AppointmentStatus;

  @Column({ type: 'enum', enum: AppointmentType, default: AppointmentType.NEW_PATIENT })
  appointmentType: AppointmentType;

  @Column({ nullable: true, type: 'text' })
  chiefComplaint: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ nullable: true })
  tokenNumber: number;

  @Column({ nullable: true, type: 'text' })
  cancelledReason: string | null;

  @Column({ nullable: true })
  cancelledBy: string;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'date', nullable: true })
  followUpDate: Date | null;
}
