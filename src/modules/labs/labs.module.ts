import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabsController } from './labs.controller';
import { LabsService } from './labs.service';
import { LabTestCatalog } from './entities/lab-test-catalog.entity';
import { LabOrder } from './entities/lab-order.entity';
import { LabOrderItem } from './entities/lab-order-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LabTestCatalog, LabOrder, LabOrderItem])],
  controllers: [LabsController],
  providers: [LabsService],
  exports: [LabsService],
})
export class LabsModule {}
