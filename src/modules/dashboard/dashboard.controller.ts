import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get clinic summary stats' })
  getSummary(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getSummary(user.clinicId);
  }

  @Get('revenue')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Revenue breakdown (admin only)' })
  @ApiQuery({ name: 'period', enum: ['today', 'week', 'month', 'year'], required: false })
  getRevenue(
    @CurrentUser() user: JwtPayload,
    @Query('period') period?: 'today' | 'week' | 'month' | 'year',
  ) {
    return this.dashboardService.getRevenue(user.clinicId, period);
  }

  @Get('appointments/stats')
  @ApiOperation({ summary: 'Appointment status breakdown' })
  @ApiQuery({ name: 'days', required: false, description: 'Last N days (default 30)' })
  getAppointmentStats(
    @CurrentUser() user: JwtPayload,
    @Query('days') days?: string,
  ) {
    return this.dashboardService.getAppointmentStats(user.clinicId, days ?? '30');
  }

  @Get('patients/stats')
  @ApiOperation({ summary: 'Patient statistics' })
  getPatientStats(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getPatientStats(user.clinicId);
  }

  @Get('doctors/stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Per-doctor appointment stats (admin only)' })
  getDoctorStats(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getDoctorStats(user.clinicId);
  }
}
