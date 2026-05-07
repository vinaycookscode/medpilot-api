import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsController, DoctorScheduleController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { Appointment } from './entities/appointment.entity';
import { DoctorSchedule, ScheduleOverride } from './entities/doctor-schedule.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Appointment, DoctorSchedule, ScheduleOverride])],
  controllers: [AppointmentsController, DoctorScheduleController],
  providers: [AppointmentsService],
  exports: [AppointmentsService, TypeOrmModule],
})
export class AppointmentsModule {}
