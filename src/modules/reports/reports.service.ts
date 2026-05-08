import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Invoice, Payment } from '../billing/entities/invoice.entity';
import { Patient } from '../patients/entities/patient.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { ReportQueryDto } from './dto/report-query.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Appointment) private appointmentsRepo: Repository<Appointment>,
    @InjectRepository(Invoice) private invoicesRepo: Repository<Invoice>,
    @InjectRepository(Payment) private paymentsRepo: Repository<Payment>,
    @InjectRepository(Patient) private patientsRepo: Repository<Patient>,
    @InjectRepository(InventoryItem) private inventoryRepo: Repository<InventoryItem>,
  ) {}

  private applyDateRange(qb: any, alias: string, field: string, query: ReportQueryDto) {
    if (query.from) {
      qb.andWhere(`${alias}.${field} >= :from`, { from: query.from });
    }
    if (query.to) {
      qb.andWhere(`${alias}.${field} <= :to`, { to: query.to });
    }
  }

  async getRevenueSummary(clinicId: string, query: ReportQueryDto) {
    // Total revenue from invoices
    const invoiceQb = this.invoicesRepo
      .createQueryBuilder('i')
      .where('i.clinicId = :clinicId', { clinicId })
      .andWhere('i.deletedAt IS NULL');
    this.applyDateRange(invoiceQb, 'i', 'invoiceDate', query);

    const [invoices] = await Promise.all([invoiceQb.getMany()]);

    const totalRevenue = invoices.reduce((sum, i) => sum + Number(i.totalAmount), 0);
    const paidRevenue = invoices.reduce((sum, i) => sum + Number(i.paidAmount), 0);
    const pendingRevenue = totalRevenue - paidRevenue;

    // Revenue by payment method from payments table
    const paymentQb = this.paymentsRepo
      .createQueryBuilder('p')
      .select('p.paymentMethod', 'method')
      .addSelect('SUM(p.amount)', 'total')
      .where('p.clinicId = :clinicId', { clinicId });
    if (query.from) paymentQb.andWhere('p.paymentDate >= :from', { from: query.from });
    if (query.to) paymentQb.andWhere('p.paymentDate <= :to', { to: query.to });
    paymentQb.groupBy('p.paymentMethod');

    const byPaymentMethod = await paymentQb.getRawMany();

    return {
      totalRevenue,
      paidRevenue,
      pendingRevenue,
      byPaymentMethod: byPaymentMethod.map((r) => ({
        method: r.method,
        total: Number(r.total),
      })),
    };
  }

  async getAppointmentStats(clinicId: string, query: ReportQueryDto) {
    const qb = this.appointmentsRepo
      .createQueryBuilder('a')
      .where('a.clinicId = :clinicId', { clinicId })
      .andWhere('a.deletedAt IS NULL');
    this.applyDateRange(qb, 'a', 'appointmentDate', query);

    const appointments = await qb.leftJoinAndSelect('a.doctor', 'doctor').getMany();

    const total = appointments.length;
    const byStatus: Record<string, number> = {};
    const byDoctor: Record<string, { name: string; count: number }> = {};
    const byDayOfWeek: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    for (const apt of appointments) {
      byStatus[apt.status] = (byStatus[apt.status] ?? 0) + 1;

      const doctorKey = apt.doctorId;
      if (!byDoctor[doctorKey]) {
        byDoctor[doctorKey] = {
          name: apt.doctor ? `${apt.doctor.firstName} ${apt.doctor.lastName}` : doctorKey,
          count: 0,
        };
      }
      byDoctor[doctorKey].count++;

      const dow = new Date(apt.appointmentDate).getDay();
      byDayOfWeek[dow] = (byDayOfWeek[dow] ?? 0) + 1;
    }

    return {
      total,
      byStatus,
      byDoctor: Object.values(byDoctor),
      byDayOfWeek,
    };
  }

  async getPatientStats(clinicId: string, query: ReportQueryDto) {
    const qb = this.patientsRepo
      .createQueryBuilder('p')
      .where('p.clinicId = :clinicId', { clinicId })
      .andWhere('p.deletedAt IS NULL');

    const allPatients = await qb.getMany();
    const total = allPatients.length;

    // New patients in date range
    const newQb = this.patientsRepo
      .createQueryBuilder('p')
      .where('p.clinicId = :clinicId', { clinicId })
      .andWhere('p.deletedAt IS NULL');
    if (query.from) newQb.andWhere('p.createdAt >= :from', { from: query.from });
    if (query.to) newQb.andWhere('p.createdAt <= :to', { to: query.to });
    const newPatients = await newQb.getCount();

    // By gender
    const byGender: Record<string, number> = {};
    // By age group
    const ageGroups = { '0-17': 0, '18-35': 0, '36-60': 0, '60+': 0, unknown: 0 };

    for (const p of allPatients) {
      if (p.gender) byGender[p.gender] = (byGender[p.gender] ?? 0) + 1;

      if (!p.dateOfBirth) {
        ageGroups.unknown++;
      } else {
        const age = p.age ?? 0;
        if (age <= 17) ageGroups['0-17']++;
        else if (age <= 35) ageGroups['18-35']++;
        else if (age <= 60) ageGroups['36-60']++;
        else ageGroups['60+']++;
      }
    }

    return {
      total,
      newPatients,
      returning: total - newPatients,
      byGender,
      byAgeGroup: ageGroups,
    };
  }

  async getInventoryStats(clinicId: string, query: ReportQueryDto) {
    const items = await this.inventoryRepo.find({
      where: { clinicId },
    });

    const totalItems = items.length;
    const lowStockCount = items.filter(
      (i) => Number(i.quantity) > 0 && Number(i.quantity) <= Number(i.reorderLevel),
    ).length;
    const outOfStockCount = items.filter((i) => Number(i.quantity) === 0).length;

    const topConsumed = items
      .filter((i) => Number(i.quantity) < Number(i.reorderLevel))
      .sort((a, b) => Number(a.quantity) - Number(b.quantity))
      .slice(0, 10)
      .map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, reorderLevel: i.reorderLevel }));

    return {
      totalItems,
      lowStockCount,
      outOfStockCount,
      topConsumed,
    };
  }

  async getDashboardSummary(clinicId: string, query: ReportQueryDto) {
    const now = new Date();

    // Current month bounds
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];

    // Last month bounds
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString()
      .split('T')[0];
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      .toISOString()
      .split('T')[0];

    // Current week bounds
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = now.toISOString().split('T')[0];

    const [
      revenueThisMonth,
      revenueLastMonth,
      appointmentsThisWeek,
      newPatientsThisMonth,
      totalPatients,
    ] = await Promise.all([
      this.invoicesRepo
        .createQueryBuilder('i')
        .select('COALESCE(SUM(i.paidAmount), 0)', 'total')
        .where('i.clinicId = :clinicId', { clinicId })
        .andWhere('i.invoiceDate >= :start', { start: currentMonthStart })
        .andWhere('i.invoiceDate <= :end', { end: currentMonthEnd })
        .andWhere('i.deletedAt IS NULL')
        .getRawOne(),
      this.invoicesRepo
        .createQueryBuilder('i')
        .select('COALESCE(SUM(i.paidAmount), 0)', 'total')
        .where('i.clinicId = :clinicId', { clinicId })
        .andWhere('i.invoiceDate >= :start', { start: lastMonthStart })
        .andWhere('i.invoiceDate <= :end', { end: lastMonthEnd })
        .andWhere('i.deletedAt IS NULL')
        .getRawOne(),
      this.appointmentsRepo.count({
        where: { clinicId },
      }),
      this.patientsRepo
        .createQueryBuilder('p')
        .where('p.clinicId = :clinicId', { clinicId })
        .andWhere('p.createdAt >= :start', { start: currentMonthStart })
        .andWhere('p.createdAt <= :end', { end: currentMonthEnd })
        .andWhere('p.deletedAt IS NULL')
        .getCount(),
      this.patientsRepo.count({ where: { clinicId } }),
    ]);

    const thisMonthRevenue = Number(revenueThisMonth?.total ?? 0);
    const lastMonthRevenue = Number(revenueLastMonth?.total ?? 0);
    const revenueGrowth =
      lastMonthRevenue > 0
        ? (((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1)
        : null;

    return {
      revenueThisMonth: thisMonthRevenue,
      revenueLastMonth: lastMonthRevenue,
      revenueGrowthPercent: revenueGrowth,
      appointmentsThisWeek,
      newPatientsThisMonth,
      totalPatients,
    };
  }
}
