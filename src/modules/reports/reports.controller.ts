import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('revenue')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Revenue summary (admin only)' })
  getRevenueSummary(@CurrentUser() user: JwtPayload, @Query() query: ReportQueryDto) {
    return this.reportsService.getRevenueSummary(user.clinicId, query);
  }

  @Get('appointments')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR)
  @ApiOperation({ summary: 'Appointment statistics' })
  getAppointmentStats(@CurrentUser() user: JwtPayload, @Query() query: ReportQueryDto) {
    return this.reportsService.getAppointmentStats(user.clinicId, query);
  }

  @Get('patients')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR)
  @ApiOperation({ summary: 'Patient statistics' })
  getPatientStats(@CurrentUser() user: JwtPayload, @Query() query: ReportQueryDto) {
    return this.reportsService.getPatientStats(user.clinicId, query);
  }

  @Get('inventory')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Inventory statistics (admin only)' })
  getInventoryStats(@CurrentUser() user: JwtPayload, @Query() query: ReportQueryDto) {
    return this.reportsService.getInventoryStats(user.clinicId, query);
  }

  @Get('dashboard-summary')
  @ApiOperation({ summary: 'Dashboard KPI summary (all roles)' })
  getDashboardSummary(@CurrentUser() user: JwtPayload, @Query() query: ReportQueryDto) {
    return this.reportsService.getDashboardSummary(user.clinicId, query);
  }
}
