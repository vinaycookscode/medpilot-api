import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { Patient } from './entities/patient.entity';
import { PatientVital } from './entities/patient-vital.entity';
import { PatientDocument } from './entities/patient-document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Patient, PatientVital, PatientDocument])],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService, TypeOrmModule],
})
export class PatientsModule {}
