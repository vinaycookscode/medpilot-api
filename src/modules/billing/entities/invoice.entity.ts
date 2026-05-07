import { Entity, Column, ManyToOne, JoinColumn, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PAID = 'paid',
  PARTIALLY_PAID = 'partially_paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  PAID = 'paid',
  REFUNDED = 'refunded',
  WAIVED = 'waived',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  UPI = 'upi',
  NETBANKING = 'netbanking',
  INSURANCE = 'insurance',
  OTHER = 'other',
}

@Entity('services')
export class ClinicService extends BaseEntity {
  @Column()
  clinicId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ nullable: true, length: 100 })
  category: string;

  @Column({ nullable: true, length: 50 })
  code: string;

  @Column({ name: 'defaultPrice', type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ default: false })
  gstApplicable: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  gstRate: number;

  @Column({ nullable: true, length: 20 })
  hsnSacCode: string;

  @Column({ default: true })
  isActive: boolean;
}

@Entity('invoices')
export class Invoice extends BaseEntity {
  @Column()
  clinicId: string;

  @Column()
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ nullable: true })
  appointmentId: string;

  @Column({ length: 50, unique: true })
  invoiceNumber: string;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  invoiceDate: Date;

  @Column({ type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
  status: InvoiceStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercent: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  cgstAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  sgstAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  igstAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ nullable: true, type: 'text' })
  terms: string;

  @Column({ nullable: true })
  pdfUrl: string;

  @Column({ nullable: true })
  createdBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdBy' })
  createdByUser: User;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: true, eager: true })
  items: InvoiceItem[];

  get balanceDue(): number {
    return Number(this.totalAmount) - Number(this.paidAmount);
  }

  get totalGst(): number {
    return Number(this.cgstAmount) + Number(this.sgstAmount) + Number(this.igstAmount);
  }
}

@Entity('invoice_items')
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  invoiceId: string;

  @ManyToOne(() => Invoice, (inv) => inv.items)
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @Column({ nullable: true })
  serviceId: string;

  @ManyToOne(() => ClinicService, { nullable: true })
  @JoinColumn({ name: 'serviceId' })
  service: ClinicService;

  @Column({ length: 255 })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  gstRate: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  gstAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  @Column({ default: 0 })
  sortOrder: number;
}

@Entity('payments')
export class Payment extends BaseEntity {
  @Column()
  clinicId: string;

  @Column()
  invoiceId: string;

  @ManyToOne(() => Invoice)
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @Column()
  patientId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  paymentDate: Date;

  @Column({ nullable: true, length: 255 })
  transactionRef: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ nullable: true })
  collectedBy: string;

  @Column({ nullable: true, length: 50, unique: true })
  receiptNumber: string;
}
