import { Entity, Column, ManyToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { LabOrder } from './lab-order.entity';
import { LabTestCatalog } from './lab-test-catalog.entity';

@Entity('lab_order_items')
export class LabOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  labOrderId: string;

  @ManyToOne(() => LabOrder, (order) => order.items)
  @JoinColumn({ name: 'labOrderId' })
  labOrder: LabOrder;

  @Column()
  testId: string;

  @ManyToOne(() => LabTestCatalog)
  @JoinColumn({ name: 'testId' })
  test: LabTestCatalog;

  @Column({ type: 'text', nullable: true })
  result: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  normalRange: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit: string | null;

  @Column({ type: 'boolean', nullable: true })
  isAbnormal: boolean | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;
}
