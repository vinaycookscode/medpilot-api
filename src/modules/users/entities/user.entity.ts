import { Entity, Column, ManyToOne, JoinColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import { Exclude } from 'class-transformer';
import * as bcrypt from 'bcrypt';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserRole } from '../enums/user-role.enum';
import { Clinic } from '../../clinics/entities/clinic.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column()
  clinicId: string;

  @ManyToOne(() => Clinic, (clinic) => clinic.users)
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @Column({ length: 255 })
  email: string;

  @Column({ nullable: true, length: 20 })
  phone: string;

  @Column()
  @Exclude()
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ length: 100 })
  firstName: string;

  @Column({ length: 100 })
  lastName: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  // Doctor-specific fields (null for non-doctors)
  @Column({ nullable: true, length: 150 })
  specialization: string;

  @Column({ nullable: true, length: 255 })
  qualification: string;

  @Column({ nullable: true, length: 100 })
  registrationNo: string;

  @Column({ nullable: true, type: 'text' })
  bio: string;

  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 2 })
  consultationFee: number;

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.passwordHash && !this.passwordHash.startsWith('$2b$')) {
      this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.passwordHash);
  }
}
