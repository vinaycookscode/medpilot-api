import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicesController, ServicesController } from './billing.controller';
import { BillingService } from './billing.service';
import { Invoice, InvoiceItem, Payment, ClinicService } from './entities/invoice.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, InvoiceItem, Payment, ClinicService])],
  controllers: [InvoicesController, ServicesController],
  providers: [BillingService],
  exports: [BillingService, TypeOrmModule],
})
export class BillingModule {}
