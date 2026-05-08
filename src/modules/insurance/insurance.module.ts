import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsuranceController } from './insurance.controller';
import { InsuranceService } from './insurance.service';
import { InsuranceProvider } from './entities/insurance-provider.entity';
import { InsuranceClaim } from './entities/insurance-claim.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InsuranceProvider, InsuranceClaim])],
  controllers: [InsuranceController],
  providers: [InsuranceService],
  exports: [InsuranceService],
})
export class InsuranceModule {}
