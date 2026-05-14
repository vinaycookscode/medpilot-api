import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  Invoice, InvoiceItem, Payment, ClinicService,
  InvoiceStatus, PaymentStatus,
} from './entities/invoice.entity';
import { CreateInvoiceDto, InvoiceItemDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Invoice) private invoicesRepo: Repository<Invoice>,
    @InjectRepository(InvoiceItem) private itemsRepo: Repository<InvoiceItem>,
    @InjectRepository(Payment) private paymentsRepo: Repository<Payment>,
    @InjectRepository(ClinicService) private servicesRepo: Repository<ClinicService>,
  ) {}

  async createInvoice(clinicId: string, createdBy: string, dto: CreateInvoiceDto): Promise<Invoice> {
    const invoiceNumber = await this.generateInvoiceNumber(clinicId);

    const computedItems = dto.items.map((item, i) => this.computeItem(item, dto.isInterState ?? false, i));
    const subtotal = computedItems.reduce((s, it) => s + it.unitPrice * it.quantity - it.discountAmount, 0);
    const discountAmount = dto.discountAmount ?? (subtotal * (dto.discountPercent ?? 0)) / 100;
    const cgstAmount = dto.isInterState ? 0 : computedItems.reduce((s, it) => s + it.gstAmount / 2, 0);
    const sgstAmount = dto.isInterState ? 0 : computedItems.reduce((s, it) => s + it.gstAmount / 2, 0);
    const igstAmount = dto.isInterState ? computedItems.reduce((s, it) => s + it.gstAmount, 0) : 0;
    const totalAmount = subtotal - discountAmount + cgstAmount + sgstAmount + igstAmount;

    const invoice = this.invoicesRepo.create({
      id: uuidv4(),
      ...dto,
      clinicId,
      createdBy,
      invoiceNumber,
      subtotal: this.round(subtotal),
      discountAmount: this.round(discountAmount),
      cgstAmount: this.round(cgstAmount),
      sgstAmount: this.round(sgstAmount),
      igstAmount: this.round(igstAmount),
      totalAmount: this.round(totalAmount),
      paidAmount: 0,
      items: computedItems.map((item) => ({ ...item, id: uuidv4() })) as InvoiceItem[],
    });

    return this.invoicesRepo.save(invoice);
  }

  async findAll(clinicId: string, query: InvoiceQueryDto) {
    const qb = this.invoicesRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.patient', 'patient')
      .where('inv.clinicId = :clinicId', { clinicId })
      .andWhere('inv.deletedAt IS NULL');

    if (query.patientId) qb.andWhere('inv.patientId = :patientId', { patientId: query.patientId });
    if (query.status) qb.andWhere('inv.status = :status', { status: query.status });
    if (query.paymentStatus) qb.andWhere('inv.paymentStatus = :ps', { ps: query.paymentStatus });
    if (query.startDate && query.endDate) {
      qb.andWhere('inv.invoiceDate BETWEEN :start AND :end', { start: query.startDate, end: query.endDate });
    }

    qb.orderBy('inv.invoiceDate', 'DESC');
    const [data, total] = await qb.skip(query.skip).take(query.limit).getManyAndCount();

    return { data, meta: { total, page: query.page, limit: query.limit } };
  }

  async findById(id: string, clinicId: string): Promise<Invoice> {
    const invoice = await this.invoicesRepo.findOne({
      where: { id, clinicId },
      relations: ['patient', 'items', 'items.service', 'createdByUser'],
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async markSent(id: string, clinicId: string): Promise<Invoice> {
    const invoice = await this.findById(id, clinicId);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be marked as sent');
    }
    invoice.status = InvoiceStatus.SENT;
    return this.invoicesRepo.save(invoice);
  }

  async recordPayment(
    invoiceId: string,
    clinicId: string,
    dto: RecordPaymentDto,
    collectedBy: string,
  ): Promise<Payment> {
    const invoice = await this.findById(invoiceId, clinicId);

    if (invoice.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Invoice is already fully paid');
    }

    const remaining = invoice.balanceDue;
    if (dto.amount > remaining + 0.01) {
      throw new BadRequestException(`Payment amount exceeds balance due (₹${remaining})`);
    }

    const receiptNumber = await this.generateReceiptNumber(clinicId);
    const payment = this.paymentsRepo.create({
      ...dto,
      id: uuidv4(),
      clinicId,
      invoiceId,
      patientId: invoice.patientId,
      collectedBy,
      receiptNumber,
    });
    await this.paymentsRepo.save(payment);

    // Recompute paid amount and update status
    const totalPaid = await this.paymentsRepo
      .createQueryBuilder('p')
      .where('p.invoiceId = :invoiceId', { invoiceId })
      .select('SUM(p.amount)', 'total')
      .getRawOne();

    invoice.paidAmount = this.round(Number(totalPaid.total) || 0);
    invoice.paymentStatus =
      invoice.paidAmount >= invoice.totalAmount
        ? PaymentStatus.PAID
        : PaymentStatus.PARTIAL;
    if (invoice.paymentStatus === PaymentStatus.PAID) {
      invoice.status = InvoiceStatus.PAID;
    }
    await this.invoicesRepo.save(invoice);

    return payment;
  }

  async getPayments(invoiceId: string, clinicId: string): Promise<Payment[]> {
    await this.findById(invoiceId, clinicId);
    return this.paymentsRepo.find({
      where: { invoiceId },
      order: { paymentDate: 'DESC' },
    });
  }

  async getPendingPayments(clinicId: string) {
    return this.invoicesRepo.find({
      where: [
        { clinicId, paymentStatus: PaymentStatus.PENDING },
        { clinicId, paymentStatus: PaymentStatus.PARTIAL },
      ],
      relations: ['patient'],
      order: { invoiceDate: 'DESC' },
    });
  }

  // Services catalog
  async createService(clinicId: string, dto: Partial<ClinicService>): Promise<ClinicService> {
    const service = this.servicesRepo.create({ ...dto, clinicId });
    return this.servicesRepo.save(service);
  }

  async getServices(clinicId: string): Promise<ClinicService[]> {
    return this.servicesRepo.find({
      where: { clinicId, isActive: true },
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  async updateService(id: string, clinicId: string, dto: Partial<ClinicService>): Promise<ClinicService> {
    const service = await this.servicesRepo.findOne({ where: { id, clinicId } });
    if (!service) throw new NotFoundException('Service not found');
    Object.assign(service, dto);
    return this.servicesRepo.save(service);
  }

  private computeItem(item: InvoiceItemDto, isInterState: boolean, sortOrder: number) {
    const qty = item.quantity ?? 1;
    const baseAmount = item.unitPrice * qty - (item.discountAmount ?? 0);
    const gstRate = item.gstRate ?? 0;
    const gstAmount = this.round((baseAmount * gstRate) / 100);
    const totalAmount = this.round(baseAmount + gstAmount);

    return {
      serviceId: item.serviceId,
      description: item.description,
      quantity: qty,
      unitPrice: item.unitPrice,
      discountAmount: item.discountAmount ?? 0,
      gstRate,
      gstAmount,
      totalAmount,
      sortOrder,
    };
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private async generateInvoiceNumber(clinicId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.invoicesRepo.count({ where: { clinicId } });
    return `INV-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private async generateReceiptNumber(clinicId: string): Promise<string> {
    const count = await this.paymentsRepo.count({ where: { clinicId } });
    return `RCP-${String(count + 1).padStart(6, '0')}`;
  }
}
