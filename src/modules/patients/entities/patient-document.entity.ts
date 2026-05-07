import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Patient } from './patient.entity';
import { User } from '../../users/entities/user.entity';

@Entity('patient_documents')
export class PatientDocument extends BaseEntity {
  @Column()
  clinicId: string;

  @Column()
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ nullable: true })
  uploadedBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'uploadedBy' })
  uploadedByUser: User;

  @Column({ length: 255 })
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column()
  fileUrl: string;

  @Column({ length: 255 })
  fileName: string;

  @Column({ nullable: true, length: 100 })
  fileType: string;

  @Column({ nullable: true, type: 'bigint' })
  fileSize: number;

  @Column({ nullable: true, length: 100 })
  documentType: string;

  @Column({ type: 'date', nullable: true })
  documentDate: Date | null;

  @Column({ nullable: true })
  appointmentId: string;
}
