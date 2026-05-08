import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('insurance_providers')
@Index(['clinicId', 'code'], { unique: true })
export class InsuranceProvider extends BaseEntity {
  @Column()
  clinicId: string;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 50 })
  code: string;

  @Column({ type: 'varchar', nullable: true, length: 255 })
  contactEmail: string | null;

  @Column({ type: 'varchar', nullable: true, length: 30 })
  contactPhone: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ default: true })
  isActive: boolean;
}
