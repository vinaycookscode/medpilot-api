import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { DoctorSchedule, ScheduleOverride, DayOfWeek } from './entities/doctor-schedule.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { AppointmentQueryDto } from './dto/appointment-query.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { SetScheduleDto, ScheduleOverrideDto } from './dto/doctor-schedule.dto';
import { UserRole } from '../users/enums/user-role.enum';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment) private appointmentsRepo: Repository<Appointment>,
    @InjectRepository(DoctorSchedule) private schedulesRepo: Repository<DoctorSchedule>,
    @InjectRepository(ScheduleOverride) private overridesRepo: Repository<ScheduleOverride>,
  ) {}

  async create(clinicId: string, dto: CreateAppointmentDto, bookedBy: string): Promise<Appointment> {
    const schedule = await this.getEffectiveSchedule(dto.doctorId, clinicId, new Date(dto.appointmentDate));
    if (!schedule) throw new BadRequestException('Doctor is not available on this date');

    const endTime = this.addMinutes(dto.startTime, schedule.slotDuration);

    const conflict = await this.appointmentsRepo.findOne({
      where: {
        clinicId,
        doctorId: dto.doctorId,
        appointmentDate: new Date(dto.appointmentDate) as any,
        startTime: dto.startTime,
        status: AppointmentStatus.SCHEDULED,
      },
    });
    if (conflict) throw new ConflictException('This slot is already booked');

    const tokenNumber = await this.getNextToken(dto.doctorId, clinicId, new Date(dto.appointmentDate));

    const appointment = this.appointmentsRepo.create({
      ...dto,
      clinicId,
      bookedBy,
      endTime,
      durationMinutes: schedule.slotDuration,
      tokenNumber,
    });
    return this.appointmentsRepo.save(appointment);
  }

  async findAll(clinicId: string, query: AppointmentQueryDto, currentUser: JwtPayload) {
    const qb = this.appointmentsRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.patient', 'patient')
      .leftJoinAndSelect('a.doctor', 'doctor')
      .where('a.clinicId = :clinicId', { clinicId })
      .andWhere('a.deletedAt IS NULL');

    if (currentUser.role === UserRole.DOCTOR) {
      qb.andWhere('a.doctorId = :doctorId', { doctorId: currentUser.sub });
    }

    if (query.date) qb.andWhere('a.appointmentDate = :date', { date: query.date });
    if (query.doctorId) qb.andWhere('a.doctorId = :doctorId', { doctorId: query.doctorId });
    if (query.patientId) qb.andWhere('a.patientId = :patientId', { patientId: query.patientId });
    if (query.status) qb.andWhere('a.status = :status', { status: query.status });
    if (query.startDate && query.endDate) {
      qb.andWhere('a.appointmentDate BETWEEN :start AND :end', {
        start: query.startDate,
        end: query.endDate,
      });
    }

    qb.orderBy('a.appointmentDate', 'ASC').addOrderBy('a.startTime', 'ASC');

    const total = await qb.getCount();
    const data = await qb.skip(query.skip).take(query.limit).getMany();

    return { data, meta: { total, page: query.page, limit: query.limit } };
  }

  async findToday(clinicId: string, currentUser: JwtPayload) {
    const today = new Date().toISOString().split('T')[0];
    const qb = this.appointmentsRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.patient', 'patient')
      .leftJoinAndSelect('a.doctor', 'doctor')
      .where('a.clinicId = :clinicId', { clinicId })
      .andWhere('a.appointmentDate = :today', { today })
      .andWhere('a.deletedAt IS NULL');

    if (currentUser.role === UserRole.DOCTOR) {
      qb.andWhere('a.doctorId = :doctorId', { doctorId: currentUser.sub });
    }

    return qb.orderBy('a.tokenNumber', 'ASC').getMany();
  }

  async findCalendar(clinicId: string, startDate: string, endDate: string, doctorId?: string) {
    const qb = this.appointmentsRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.patient', 'patient')
      .leftJoinAndSelect('a.doctor', 'doctor')
      .where('a.clinicId = :clinicId', { clinicId })
      .andWhere('a.appointmentDate BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('a.deletedAt IS NULL');

    if (doctorId) qb.andWhere('a.doctorId = :doctorId', { doctorId });
    return qb.orderBy('a.appointmentDate', 'ASC').addOrderBy('a.startTime', 'ASC').getMany();
  }

  async findById(id: string, clinicId: string): Promise<Appointment> {
    const appointment = await this.appointmentsRepo.findOne({
      where: { id, clinicId },
      relations: ['patient', 'doctor'],
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    return appointment;
  }

  async updateStatus(
    id: string,
    clinicId: string,
    dto: UpdateAppointmentStatusDto,
    userId: string,
  ): Promise<Appointment> {
    const appointment = await this.findById(id, clinicId);

    appointment.status = dto.status;
    if (dto.status === AppointmentStatus.CANCELLED) {
      appointment.cancelledReason = dto.reason ?? null;
      appointment.cancelledBy = userId;
      appointment.cancelledAt = new Date();
    }
    return this.appointmentsRepo.save(appointment);
  }

  async softDelete(id: string, clinicId: string): Promise<void> {
    await this.findById(id, clinicId);
    await this.appointmentsRepo.softDelete(id);
  }

  // Doctor schedules

  async setSchedule(doctorId: string, clinicId: string, dto: SetScheduleDto): Promise<DoctorSchedule> {
    let schedule = await this.schedulesRepo.findOne({
      where: { doctorId, clinicId, dayOfWeek: dto.dayOfWeek },
    });

    if (schedule) {
      Object.assign(schedule, dto);
    } else {
      schedule = this.schedulesRepo.create({ ...dto, doctorId, clinicId });
    }
    return this.schedulesRepo.save(schedule);
  }

  async getDoctorSchedules(doctorId: string, clinicId: string): Promise<DoctorSchedule[]> {
    return this.schedulesRepo.find({
      where: { doctorId, clinicId, isActive: true },
      order: { dayOfWeek: 'ASC' },
    });
  }

  async addOverride(
    doctorId: string,
    clinicId: string,
    dto: ScheduleOverrideDto,
  ): Promise<ScheduleOverride> {
    let override = await this.overridesRepo.findOne({
      where: { doctorId, clinicId, overrideDate: new Date(dto.overrideDate) as any },
    });

    if (override) {
      Object.assign(override, dto);
    } else {
      override = this.overridesRepo.create({ ...dto, doctorId, clinicId });
    }
    return this.overridesRepo.save(override);
  }

  async getAvailableSlots(doctorId: string, clinicId: string, date: string) {
    const schedule = await this.getEffectiveSchedule(doctorId, clinicId, new Date(date));
    if (!schedule) return [];

    const allSlots = this.generateTimeSlots(schedule.startTime, schedule.endTime, schedule.slotDuration);

    const booked = await this.appointmentsRepo.find({
      where: {
        doctorId,
        clinicId,
        appointmentDate: new Date(date) as any,
      },
      select: ['startTime', 'status'],
    });

    const bookedTimes = new Set(
      booked
        .filter((b) => ![AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW].includes(b.status))
        .map((b) => b.startTime),
    );

    return allSlots.map((slot) => ({
      startTime: slot,
      endTime: this.addMinutes(slot, schedule.slotDuration),
      available: !bookedTimes.has(slot),
    }));
  }

  private async getEffectiveSchedule(doctorId: string, clinicId: string, date: Date) {
    const override = await this.overridesRepo.findOne({
      where: { doctorId, clinicId, overrideDate: date as any },
    });

    if (override?.isDayOff) return null;

    const dayName = this.getDayName(date);
    const schedule = await this.schedulesRepo.findOne({
      where: { doctorId, clinicId, dayOfWeek: dayName, isActive: true },
    });

    if (!schedule) return null;

    if (override) {
      return {
        ...schedule,
        startTime: override.startTime ?? schedule.startTime,
        endTime: override.endTime ?? schedule.endTime,
      };
    }
    return schedule;
  }

  private generateTimeSlots(start: string, end: string, slotMinutes: number): string[] {
    const slots: string[] = [];
    let [h, m] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const endTotal = endH * 60 + endM;

    while (h * 60 + m < endTotal) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      m += slotMinutes;
      if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
    }
    return slots;
  }

  private addMinutes(time: string, minutes: number): string {
    let [h, m] = time.split(':').map(Number);
    m += minutes;
    h += Math.floor(m / 60);
    m = m % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  private getDayName(date: Date): DayOfWeek {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()] as DayOfWeek;
  }

  private async getNextToken(doctorId: string, clinicId: string, date: Date): Promise<number> {
    const count = await this.appointmentsRepo.count({
      where: { doctorId, clinicId, appointmentDate: date as any },
    });
    return count + 1;
  }
}
