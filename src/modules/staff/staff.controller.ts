import {
  Controller, Get, Patch, Post, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StaffService } from './staff.service';
import { QueryStaffDto } from './dto/query-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { LeaveStatus } from './entities/staff-leave.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'List all staff members' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryStaffDto) {
    return this.staffService.findAll(user.clinicId, query);
  }

  @Get('doctors')
  @ApiOperation({ summary: 'List active doctors (dropdown)' })
  findDoctors(@CurrentUser() user: JwtPayload) {
    return this.staffService.findDoctors(user.clinicId);
  }

  @Get('leaves')
  @ApiOperation({ summary: 'Get leaves — admin sees all, others see own' })
  getLeaves(
    @CurrentUser() user: JwtPayload,
    @Query('userId') userId?: string,
  ) {
    return this.staffService.getLeaves(user.sub, user.role, userId);
  }

  @Post('leaves')
  @ApiOperation({ summary: 'Submit a leave request' })
  createLeave(@CurrentUser() user: JwtPayload, @Body() dto: CreateLeaveDto) {
    return this.staffService.createLeave(user.sub, dto);
  }

  @Patch('leaves/:id/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve or reject a leave request (admin only)' })
  updateLeaveStatus(
    @Param('id') id: string,
    @Body('status') status: LeaveStatus,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.staffService.updateLeaveStatus(id, status, user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a staff member by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.staffService.findOne(id, user.clinicId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update staff member (admin only)' })
  updateStaff(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staffService.updateStaff(id, dto, user.clinicId);
  }
}
