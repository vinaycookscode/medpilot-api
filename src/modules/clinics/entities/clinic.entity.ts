import { Entity, Column, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('clinics')
export class Clinic extends BaseEntity {
  @ApiProperty()
  @Column({ length: 255 })
  name: string;

  @ApiProperty()
  @Column({ length: 100, unique: true })
  slug: string;

  @ApiProperty()
  @Column({ length: 50 })
  type: string;

  @Column({ nullable: true })
  logoUrl: string;

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

  @Column({ default: 'India', length: 100 })
  country: string;

  @Column({ nullable: true, length: 20 })
  phone: string;

  @Column({ nullable: true, length: 255 })
  email: string;

  @Column({ nullable: true })
  website: string;

  @Column({ default: 'Asia/Kolkata', length: 100 })
  timezone: string;

  @Column({ default: 'INR', length: 10 })
  currency: string;

  @Column({ nullable: true, length: 20 })
  gstin: string;

  @Column({ default: false })
  gstRegistered: boolean;

  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, unknown>;

  @Column({ nullable: true })
  registrationNumber: string;

  @OneToMany(() => User, (user) => user.clinic)
  users: User[];
}
