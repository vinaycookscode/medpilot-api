import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('clinics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new clinic' })
  create(@Body() dto: CreateClinicDto) {
    return this.clinicsService.create(dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current clinic details' })
  getMyClinc(@CurrentUser() user: JwtPayload) {
    return this.clinicsService.findById(user.clinicId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get clinic by ID' })
  findOne(@Param('id') id: string) {
    return this.clinicsService.findById(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update clinic info (admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateClinicDto) {
    return this.clinicsService.update(id, dto);
  }

  @Put(':id/settings')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update clinic settings' })
  updateSettings(@Param('id') id: string, @Body() settings: Record<string, unknown>) {
    return this.clinicsService.updateSettings(id, settings);
  }

  // ── Branch endpoints ──────────────────────────────────────────

  @Get('me/branches')
  @ApiOperation({ summary: 'List branches for current clinic' })
  getBranches(@CurrentUser() user: JwtPayload) {
    return this.clinicsService.getBranches(user.clinicId);
  }

  @Post('me/branches')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new branch' })
  createBranch(@CurrentUser() user: JwtPayload, @Body() dto: CreateBranchDto) {
    return this.clinicsService.createBranch(user.clinicId, dto);
  }

  @Patch('me/branches/:branchId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a branch' })
  updateBranch(@Param('branchId') branchId: string, @CurrentUser() user: JwtPayload, @Body() dto: Partial<CreateBranchDto>) {
    return this.clinicsService.updateBranch(branchId, user.clinicId, dto);
  }

  @Delete('me/branches/:branchId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a branch' })
  deleteBranch(@Param('branchId') branchId: string, @CurrentUser() user: JwtPayload) {
    return this.clinicsService.deleteBranch(branchId, user.clinicId);
  }
}
