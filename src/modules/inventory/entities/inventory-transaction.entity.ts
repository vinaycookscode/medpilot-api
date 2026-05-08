import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { InventoryItem } from './inventory-item.entity';

export enum TransactionType {
  IN         = 'in',
  OUT        = 'out',
  ADJUSTMENT = 'adjustment',
}

@Entity('inventory_transactions')
export class InventoryTransaction extends BaseEntity {
  @Column()
  clinicId: string;

  @Column()
  itemId: string;

  @ManyToOne(() => InventoryItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'itemId' })
  item: InventoryItem;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantityBefore: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantityAfter: number;

  @Column({ nullable: true, type: 'text' })
  note: string;

  @Column()
  createdBy: string;
}
