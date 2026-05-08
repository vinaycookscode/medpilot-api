import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';
import { Clinic } from './entities/clinic.entity';
import { Branch } from './entities/branch.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Clinic, Branch])],
  controllers: [ClinicsController],
  providers: [ClinicsService],
  exports: [ClinicsService],
})
export class ClinicsModule {}
