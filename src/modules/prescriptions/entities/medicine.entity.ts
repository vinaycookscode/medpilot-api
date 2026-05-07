import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('medicines')
export class Medicine extends BaseEntity {
  @Column({ nullable: true })
  clinicId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ nullable: true, length: 255 })
  genericName: string;

  @Column({ nullable: true, length: 100 })
  category: string;

  @Column({ nullable: true, length: 50 })
  form: string;

  @Column({ nullable: true, length: 50 })
  strength: string;

  @Column({ nullable: true, length: 255 })
  manufacturer: string;

  @Column({ default: true })
  isActive: boolean;
}
