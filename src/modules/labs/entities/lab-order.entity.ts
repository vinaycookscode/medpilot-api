import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { User } from '../../users/entities/user.entity';
import { LabOrderItem } from './lab-order-item.entity';

export enum LabOrderStatus {
  PENDING = 'pending',
  SAMPLE_COLLECTED = 'sample_collected',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('lab_orders')
@Index(['clinicId', 'patientId'])
@Index(['clinicId', 'status'])
export class LabOrder extends BaseEntity {
  @Column()
  clinicId: string;

  @Column()
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'varchar', nullable: true })
  appointmentId: string | null;

  @ManyToOne(() => Appointment, { nullable: true })
  @JoinColumn({ name: 'appointmentId' })
  appointment: Appointment | null;

  @Column()
  orderedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'orderedById' })
  orderedBy: User;

  @Column({ type: 'enum', enum: LabOrderStatus, default: LabOrderStatus.PENDING })
  status: LabOrderStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  collectedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @OneToMany(() => LabOrderItem, (item) => item.labOrder, { cascade: true, eager: true })
  items: LabOrderItem[];
}
