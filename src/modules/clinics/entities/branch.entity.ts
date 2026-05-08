import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Clinic } from './clinic.entity';

@Entity('branches')
export class Branch extends BaseEntity {
  @Column()
  clinicId: string;

  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @Column({ length: 255 })
  name: string;

  @Column({ nullable: true })
  addressLine1: string;

  @Column({ nullable: true })
  addressLine2: string;

  @Column({ nullable: true, length: 100 })
  city: string;

  @Column({ nullable: true, length: 100 })
  state: string;

  @Column({ nullable: true, length: 10 })
  pincode: string;

  @Column({ nullable: true, length: 20 })
  phone: string;

  @Column({ nullable: true, length: 255 })
  email: string;

  @Column({ default: false })
  isHeadOffice: boolean;

  @Column({ default: true })
  isActive: boolean;
}
