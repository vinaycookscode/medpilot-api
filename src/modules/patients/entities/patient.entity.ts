import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { User } from '../../users/entities/user.entity';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say',
}

export enum BloodGroup {
  A_POSITIVE = 'A+',
  A_NEGATIVE = 'A-',
  B_POSITIVE = 'B+',
  B_NEGATIVE = 'B-',
  AB_POSITIVE = 'AB+',
  AB_NEGATIVE = 'AB-',
  O_POSITIVE = 'O+',
  O_NEGATIVE = 'O-',
  UNKNOWN = 'unknown',
}

@Entity('patients')
@Index(['clinicId', 'phone'], { unique: true })
@Index(['clinicId', 'patientCode'], { unique: true })
export class Patient extends BaseEntity {
  @Column()
  clinicId: string;

  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @Column({ length: 20 })
  patientCode: string;

  @Column({ length: 100 })
  firstName: string;

  @Column({ length: 100 })
  lastName: string;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date | null;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender | null;

  @Column({ type: 'enum', enum: BloodGroup, default: BloodGroup.UNKNOWN })
  bloodGroup: BloodGroup;

  @Column({ length: 20 })
  phone: string;

  @Column({ nullable: true, length: 20 })
  phoneAlt: string;

  @Column({ nullable: true, length: 255 })
  email: string;

  @Column({ nullable: true })
  addressLine1: string;

  @Column({ nullable: true, length: 100 })
  city: string;

  @Column({ nullable: true, length: 100 })
  state: string;

  @Column({ nullable: true, length: 10 })
  pincode: string;

  @Column({ type: 'text', array: true, default: [] })
  allergies: string[];

  @Column({ type: 'text', array: true, default: [] })
  chronicConditions: string[];

  @Column({ type: 'text', array: true, default: [] })
  currentMedications: string[];

  @Column({ nullable: true, length: 200 })
  emergencyName: string;

  @Column({ nullable: true, length: 20 })
  emergencyPhone: string;

  @Column({ nullable: true, length: 50 })
  emergencyRelation: string;

  @Column({ nullable: true })
  referredBy: string;

  @Column({ nullable: true, length: 50 })
  idType: string;

  @Column({ nullable: true, length: 50 })
  idNumber: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ type: 'text', array: true, default: [] })
  tags: string[];

  @Column({ nullable: true })
  profilePhotoUrl: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  createdBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdBy' })
  createdByUser: User;

  // ─── ABHA / ABDM ──────────────────────────────────────────────────────────
  @Column({ nullable: true, type: 'text' })
  abhaNumber: string | null;

  @Column({ nullable: true, type: 'text' })
  abhaAddress: string | null;

  @Column({ default: false })
  abhaVerified: boolean;

  @Column({ nullable: true, type: 'varchar', length: 30 })
  abhaKycType: string | null;

  @Column({ nullable: true, type: 'timestamptz' })
  abhaLinkedAt: Date | null;

  // Short-lived patient X-Token from ABDM (for card download) — never exposed in API responses
  @Column({ nullable: true, type: 'text', select: false })
  abhaXToken: string | null;

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  get age(): number | null {
    if (!this.dateOfBirth) return null;
    const today = new Date();
    const birth = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }
}
