import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('inventory_items')
@Index(['clinicId', 'name'])
export class InventoryItem extends BaseEntity {
  @Column()
  clinicId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 100, default: 'General' })
  category: string;

  @Column({ length: 50, default: 'units' })
  unit: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 10 })
  reorderLevel: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  costPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  sellingPrice: number;

  @Column({ nullable: true, length: 255 })
  manufacturer: string;

  @Column({ nullable: true, length: 100 })
  batchNumber: string;

  @Column({ nullable: true, type: 'date' })
  expiryDate: Date;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ default: true })
  isActive: boolean;
}
