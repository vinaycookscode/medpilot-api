import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum NotificationType {
  APPOINTMENT = 'appointment',
  BILLING = 'billing',
  INVENTORY = 'inventory',
  SYSTEM = 'system',
  LAB = 'lab',
  REMINDER = 'reminder',
}

@Entity('notifications')
export class Notification extends BaseEntity {
  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  clinicId: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ nullable: true, length: 500 })
  link: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
