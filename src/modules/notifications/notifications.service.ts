import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private notificationsRepo: Repository<Notification>,
  ) {}

  async create(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationsRepo.create(dto);
    return this.notificationsRepo.save(notification);
  }

  async createForClinic(
    clinicId: string,
    dto: Omit<CreateNotificationDto, 'userId' | 'clinicId'> & { userId: string },
  ): Promise<Notification> {
    return this.create({ ...dto, clinicId });
  }

  async findAll(userId: string, clinicId: string, query: QueryNotificationsDto) {
    const qb = this.notificationsRepo
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .andWhere('n.clinicId = :clinicId', { clinicId })
      .orderBy('n.createdAt', 'DESC');

    if (query.isRead !== undefined) {
      qb.andWhere('n.isRead = :isRead', { isRead: query.isRead });
    }

    const total = await qb.getCount();
    const data = await qb.skip(query.skip).take(query.limit).getMany();

    return { data, meta: { total, page: query.page, limit: query.limit } };
  }

  async getUnreadCount(userId: string, clinicId: string): Promise<{ count: number }> {
    const count = await this.notificationsRepo.count({
      where: { userId, clinicId, isRead: false },
    });
    return { count };
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationsRepo.findOne({ where: { id } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId) throw new ForbiddenException('Access denied');

    notification.isRead = true;
    return this.notificationsRepo.save(notification);
  }

  async markAllRead(userId: string, clinicId: string): Promise<{ updated: number }> {
    const result = await this.notificationsRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true })
      .where('userId = :userId', { userId })
      .andWhere('clinicId = :clinicId', { clinicId })
      .andWhere('isRead = false')
      .execute();

    return { updated: result.affected ?? 0 };
  }

  async remove(id: string, userId: string): Promise<void> {
    const notification = await this.notificationsRepo.findOne({ where: { id } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId) throw new ForbiddenException('Access denied');
    await this.notificationsRepo.softDelete(id);
  }

  // Static-style helper for other modules to push notifications
  async push(
    userId: string,
    clinicId: string,
    type: NotificationType,
    title: string,
    message: string,
    options?: { link?: string; metadata?: Record<string, any> },
  ): Promise<Notification> {
    return this.create({
      userId,
      clinicId,
      type,
      title,
      message,
      link: options?.link,
      metadata: options?.metadata,
    });
  }
}
