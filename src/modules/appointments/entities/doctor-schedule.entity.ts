import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum DayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday',
}

@Entity('doctor_schedules')
@Index(['clinicId', 'doctorId', 'dayOfWeek'], { unique: true })
export class DoctorSchedule extends BaseEntity {
  @Column()
  clinicId: string;

  @Column()
  doctorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'doctorId' })
  doctor: User;

  @Column({ type: 'enum', enum: DayOfWeek })
  dayOfWeek: DayOfWeek;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  @Column({ default: 20 })
  slotDuration: number;

  @Column({ default: 20 })
  maxPatients: number;

  @Column({ default: true })
  isActive: boolean;
}

@Entity('schedule_overrides')
@Index(['clinicId', 'doctorId', 'overrideDate'], { unique: true })
export class ScheduleOverride extends BaseEntity {
  @Column()
  clinicId: string;

  @Column()
  doctorId: string;

  @Column({ type: 'date' })
  overrideDate: Date;

  @Column({ default: false })
  isDayOff: boolean;

  @Column({ type: 'time', nullable: true })
  startTime: string | null;

  @Column({ type: 'time', nullable: true })
  endTime: string | null;

  @Column({ nullable: true, length: 255 })
  reason: string;
}
