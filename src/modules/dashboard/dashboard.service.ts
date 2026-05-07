import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class DashboardService {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async getSummary(clinicId: string) {
    const today = new Date().toISOString().split('T')[0];

    const [appointments, revenue, patients, pendingInvoices] = await Promise.all([
      this.getTodayAppointmentStats(clinicId, today),
      this.getTodayRevenue(clinicId, today),
      this.getPatientStats(clinicId),
      this.getPendingInvoiceStats(clinicId),
    ]);

    return {
      todayAppointments: appointments,
      todayRevenue: revenue,
      totalPatients: patients.total,
      newPatientsThisMonth: patients.newThisMonth,
      pendingInvoicesCount: pendingInvoices.count,
      pendingInvoicesAmount: pendingInvoices.amount,
    };
  }

  async getRevenue(clinicId: string, period: 'today' | 'week' | 'month' | 'year' = 'month') {
    const intervals: Record<string, string> = {
      today: '1 day',
      week: '7 days',
      month: '30 days',
      year: '365 days',
    };

    const result = await this.dataSource.query(
      `SELECT
        DATE("paymentDate") as date,
        SUM(amount) as total,
        COUNT(*) as transactions
       FROM payments
       WHERE "clinicId" = $1
         AND "paymentDate" >= CURRENT_DATE - INTERVAL '${intervals[period]}'
       GROUP BY DATE("paymentDate")
       ORDER BY date ASC`,
      [clinicId],
    );

    const summary = await this.dataSource.query(
      `SELECT
        COALESCE(SUM(amount), 0) as total_collected,
        COUNT(*) as total_transactions
       FROM payments
       WHERE "clinicId" = $1
         AND "paymentDate" >= CURRENT_DATE - INTERVAL '${intervals[period]}'`,
      [clinicId],
    );

    return {
      chart: result,
      totalCollected: Number(summary[0].total_collected),
      totalTransactions: Number(summary[0].total_transactions),
      period,
    };
  }

  async getAppointmentStats(clinicId: string, period = '30') {
    const result = await this.dataSource.query(
      `SELECT
        status,
        COUNT(*) as count
       FROM appointments
       WHERE "clinicId" = $1
         AND "appointmentDate" >= CURRENT_DATE - INTERVAL '${period} days'
         AND "deletedAt" IS NULL
       GROUP BY status`,
      [clinicId],
    );
    return result;
  }

  async getPatientStats(clinicId: string) {
    const result = await this.dataSource.query(
      `SELECT
        COUNT(*) FILTER (WHERE "deletedAt" IS NULL) as total,
        COUNT(*) FILTER (WHERE "createdAt" >= DATE_TRUNC('month', NOW()) AND "deletedAt" IS NULL) as new_this_month,
        COUNT(*) FILTER (WHERE "createdAt" >= DATE_TRUNC('week', NOW()) AND "deletedAt" IS NULL) as new_this_week
       FROM patients
       WHERE "clinicId" = $1`,
      [clinicId],
    );

    return {
      total: Number(result[0].total),
      newThisMonth: Number(result[0].new_this_month),
      newThisWeek: Number(result[0].new_this_week),
    };
  }

  async getDoctorStats(clinicId: string) {
    return this.dataSource.query(
      `SELECT
        u.id,
        u."firstName" || ' ' || u."lastName" as name,
        u.specialization,
        COUNT(a.id) FILTER (WHERE a."appointmentDate" = CURRENT_DATE) as today_count,
        COUNT(a.id) FILTER (WHERE a."appointmentDate" >= DATE_TRUNC('month', NOW())) as month_count,
        COUNT(a.id) FILTER (WHERE a.status = 'completed' AND a."appointmentDate" >= DATE_TRUNC('month', NOW())) as completed_count
       FROM users u
       LEFT JOIN appointments a ON a."doctorId" = u.id AND a."clinicId" = $1 AND a."deletedAt" IS NULL
       WHERE u."clinicId" = $1 AND u.role = 'doctor' AND u."isActive" = true
       GROUP BY u.id, u."firstName", u."lastName", u.specialization
       ORDER BY today_count DESC`,
      [clinicId],
    );
  }

  private async getTodayAppointmentStats(clinicId: string, today: string) {
    const result = await this.dataSource.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status IN ('scheduled', 'confirmed')) as pending,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COUNT(*) FILTER (WHERE status = 'no_show') as no_show
       FROM appointments
       WHERE "clinicId" = $1
         AND "appointmentDate" = $2
         AND "deletedAt" IS NULL`,
      [clinicId, today],
    );
    return {
      total: Number(result[0].total),
      completed: Number(result[0].completed),
      pending: Number(result[0].pending),
      cancelled: Number(result[0].cancelled),
      noShow: Number(result[0].no_show),
    };
  }

  private async getTodayRevenue(clinicId: string, today: string) {
    const result = await this.dataSource.query(
      `SELECT
        COALESCE(SUM(p.amount), 0) as collected,
        COALESCE(SUM(i."totalAmount" - i."paidAmount"), 0) as pending
       FROM invoices i
       LEFT JOIN payments p ON p."invoiceId" = i.id AND DATE(p."paymentDate") = $2
       WHERE i."clinicId" = $1
         AND i."invoiceDate" = $2
         AND i."deletedAt" IS NULL`,
      [clinicId, today],
    );
    return {
      collected: Number(result[0].collected),
      pending: Number(result[0].pending),
    };
  }

  private async getPendingInvoiceStats(clinicId: string) {
    const result = await this.dataSource.query(
      `SELECT
        COUNT(*) as count,
        COALESCE(SUM("totalAmount" - "paidAmount"), 0) as amount
       FROM invoices
       WHERE "clinicId" = $1
         AND "paymentStatus" IN ('pending', 'partial')
         AND "deletedAt" IS NULL`,
      [clinicId],
    );
    return {
      count: Number(result[0].count),
      amount: Number(result[0].amount),
    };
  }
}
