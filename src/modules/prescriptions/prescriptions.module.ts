import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { Prescription, PrescriptionMedicine, PrescriptionTest } from './entities/prescription.entity';
import { Medicine } from './entities/medicine.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Prescription, PrescriptionMedicine, PrescriptionTest, Medicine]),
  ],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService],
  exports: [PrescriptionsService, TypeOrmModule],
})
export class PrescriptionsModule {}
