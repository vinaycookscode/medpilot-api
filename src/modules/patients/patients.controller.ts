import {
  Controller, Get, Post, Put, Delete, Patch, Body,
  Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { PatientQueryDto } from './dto/patient-query.dto';
import { AddVitalDto } from './dto/add-vital.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('patients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Register a new patient' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePatientDto) {
    return this.patientsService.create(user.clinicId, dto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List patients with search & pagination' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: PatientQueryDto) {
    return this.patientsService.findAll(user.clinicId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patient detail' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.patientsService.findById(id, user.clinicId);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Update patient info' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: Partial<CreatePatientDto>,
  ) {
    return this.patientsService.update(id, user.clinicId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete patient (admin only)' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.patientsService.softDelete(id, user.clinicId);
  }

  // Vitals
  @Post(':id/vitals')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR)
  @ApiOperation({ summary: 'Record patient vitals' })
  addVital(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: AddVitalDto,
  ) {
    return this.patientsService.addVital(id, user.clinicId, dto, user.sub);
  }

  @Get(':id/vitals')
  @ApiOperation({ summary: 'Get patient vitals history' })
  getVitals(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.patientsService.getVitals(id, user.clinicId);
  }

  // Documents
  @Get(':id/documents')
  @ApiOperation({ summary: 'List patient documents' })
  getDocuments(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.patientsService.getDocuments(id, user.clinicId);
  }

  @Delete(':id/documents/:docId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete document (admin only)' })
  deleteDocument(
    @Param('docId') docId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.patientsService.deleteDocument(docId, user.clinicId);
  }
}
