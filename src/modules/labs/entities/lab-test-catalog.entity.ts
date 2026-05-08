import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum LabTestCategory {
  HAEMATOLOGY = 'haematology',
  BIOCHEMISTRY = 'biochemistry',
  MICROBIOLOGY = 'microbiology',
  RADIOLOGY = 'radiology',
  PATHOLOGY = 'pathology',
  CARDIOLOGY = 'cardiology',
  OTHER = 'other',
}

@Entity('lab_test_catalog')
@Index(['clinicId', 'name'])
export class LabTestCatalog extends BaseEntity {
  @Column()
  clinicId: string;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'enum', enum: LabTestCategory, default: LabTestCategory.OTHER })
  category: LabTestCategory;

  @Column({ length: 50, nullable: true })
  unit: string | null;

  @Column({ length: 100, nullable: true })
  normalRange: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price: number | null;

  @Column({ default: true })
  isActive: boolean;
}
