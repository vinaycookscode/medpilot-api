import {
  Controller, Get, Post, Put, Patch, Delete, Body,
  Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { AppointmentQueryDto } from './dto/appointment-query.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { SetScheduleDto, ScheduleOverrideDto } from './dto/doctor-schedule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Book a new appointment' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(user.clinicId, dto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List appointments with filters' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: AppointmentQueryDto) {
    return this.appointmentsService.findAll(user.clinicId, query, user);
  }

  @Get('today')
  @ApiOperation({ summary: "Today's appointment queue" })
  today(@CurrentUser() user: JwtPayload) {
    return this.appointmentsService.findToday(user.clinicId, user);
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Calendar view (date range)' })
  @ApiQuery({ name: 'startDate', required: true, example: '2024-11-01' })
  @ApiQuery({ name: 'endDate', required: true, example: '2024-11-30' })
  @ApiQuery({ name: 'doctorId', required: false })
  calendar(
    @CurrentUser() user: JwtPayload,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('doctorId') doctorId?: string,
  ) {
    return this.appointmentsService.findCalendar(user.clinicId, startDate, endDate, doctorId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get appointment detail' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.appointmentsService.findById(id, user.clinicId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update appointment status' })
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    return this.appointmentsService.updateStatus(id, user.clinicId, dto, user.sub);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel appointment' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.appointmentsService.softDelete(id, user.clinicId);
  }
}

// Separate controller for doctor schedule endpoints
import { Controller as ScheduleCtrl } from '@nestjs/common';

@ApiTags('appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('doctors/:doctorId')
export class DoctorScheduleController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get('available-slots')
  @ApiOperation({ summary: 'Get available appointment slots for a doctor on a date' })
  @ApiQuery({ name: 'date', required: true, example: '2024-11-15' })
  getSlots(
    @Param('doctorId') doctorId: string,
    @Query('date') date: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.appointmentsService.getAvailableSlots(doctorId, user.clinicId, date);
  }

  @Get('schedule')
  @ApiOperation({ summary: 'Get doctor weekly schedule' })
  getSchedule(@Param('doctorId') doctorId: string, @CurrentUser() user: JwtPayload) {
    return this.appointmentsService.getDoctorSchedules(doctorId, user.clinicId);
  }

  @Post('schedule')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Set doctor schedule slot (admin only)' })
  setSchedule(
    @Param('doctorId') doctorId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SetScheduleDto,
  ) {
    return this.appointmentsService.setSchedule(doctorId, user.clinicId, dto);
  }

  @Post('schedule/override')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Add schedule override / holiday (admin only)' })
  addOverride(
    @Param('doctorId') doctorId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ScheduleOverrideDto,
  ) {
    return this.appointmentsService.addOverride(doctorId, user.clinicId, dto);
  }
}
