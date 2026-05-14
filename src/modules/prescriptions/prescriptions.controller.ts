import {
  Controller, Get, Post, Put, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { PrescriptionQueryDto } from './dto/prescription-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('prescriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post()
  @Roles(UserRole.DOCTOR)
  @ApiOperation({ summary: 'Create prescription (doctor only)' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePrescriptionDto) {
    return this.prescriptionsService.create(user.clinicId, user.sub, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'List prescriptions' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: PrescriptionQueryDto) {
    return this.prescriptionsService.findAll(user.clinicId, query, user);
  }

  @Get('followups')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Get follow-up patients grouped by overdue / today / upcoming' })
  @ApiQuery({ name: 'days', required: false, description: 'Lookahead window in days (default 60)' })
  getFollowups(@CurrentUser() user: JwtPayload, @Query('days') days?: string) {
    return this.prescriptionsService.getFollowups(user.clinicId, user, days ? Number(days) : 60);
  }

  @Get('medicines/search')
  @ApiOperation({ summary: 'Search medicines (autocomplete)' })
  @ApiQuery({ name: 'q', required: true })
  searchMedicines(@Query('q') q: string, @CurrentUser() user: JwtPayload) {
    return this.prescriptionsService.searchMedicines(q, user.clinicId);
  }

  @Get('diagnoses/suggest')
  @ApiOperation({ summary: 'Suggest diagnoses (autocomplete)' })
  @ApiQuery({ name: 'q', required: true })
  suggestDiagnoses(@Query('q') q: string, @CurrentUser() user: JwtPayload) {
    return this.prescriptionsService.suggestDiagnoses(q, user.clinicId);
  }

  @Get('tests/suggest')
  @ApiOperation({ summary: 'Suggest lab test names (autocomplete)' })
  @ApiQuery({ name: 'q', required: true })
  suggestTests(@Query('q') q: string, @CurrentUser() user: JwtPayload) {
    return this.prescriptionsService.suggestTests(q, user.clinicId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR)
  @ApiOperation({ summary: 'Get prescription detail' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.prescriptionsService.findById(id, user.clinicId);
  }

  @Put(':id')
  @Roles(UserRole.DOCTOR)
  @ApiOperation({ summary: 'Update prescription (doctor only, same day)' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: Partial<CreatePrescriptionDto>,
  ) {
    return this.prescriptionsService.update(id, user.clinicId, dto, user);
  }
}
