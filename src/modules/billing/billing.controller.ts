import {
  Controller, Get, Post, Put, Patch, Body,
  Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { ClinicService } from './entities/invoice.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly billingService: BillingService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Create invoice' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateInvoiceDto) {
    return this.billingService.createInvoice(user.clinicId, user.sub, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'List invoices' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: InvoiceQueryDto) {
    return this.billingService.findAll(user.clinicId, query);
  }

  @Get('pending')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Get all pending/partial payment invoices' })
  pending(@CurrentUser() user: JwtPayload) {
    return this.billingService.getPendingPayments(user.clinicId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Get invoice detail' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.billingService.findById(id, user.clinicId);
  }

  @Patch(':id/send')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Mark invoice as sent' })
  markSent(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.billingService.markSent(id, user.clinicId);
  }

  @Post(':id/payments')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Record payment against invoice' })
  recordPayment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.billingService.recordPayment(id, user.clinicId, dto, user.sub);
  }

  @Get(':id/payments')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Get payments for an invoice' })
  getPayments(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.billingService.getPayments(id, user.clinicId);
  }
}

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('services')
export class ServicesController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @ApiOperation({ summary: 'Get clinic services catalog' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.billingService.getServices(user.clinicId);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Add service to catalog (admin only)' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: Partial<ClinicService>) {
    return this.billingService.createService(user.clinicId, dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update service (admin only)' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: Partial<ClinicService>,
  ) {
    return this.billingService.updateService(id, user.clinicId, dto);
  }
}
