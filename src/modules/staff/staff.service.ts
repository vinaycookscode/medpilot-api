import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { StaffLeave, LeaveStatus } from './entities/staff-leave.entity';
import { QueryStaffDto } from './dto/query-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { CreateLeaveDto } from './dto/create-leave.dto';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(StaffLeave) private leavesRepo: Repository<StaffLeave>,
  ) {}

  async findAll(clinicId: string, query: QueryStaffDto) {
    const qb = this.usersRepo
      .createQueryBuilder('u')
      .where('u.clinicId = :clinicId', { clinicId })
      .andWhere('u.deletedAt IS NULL');

    if (query.role) qb.andWhere('u.role = :role', { role: query.role });
    if (query.isActive !== undefined) qb.andWhere('u.isActive = :isActive', { isActive: query.isActive });
    if (query.search) {
      qb.andWhere(
        `(u.firstName ILIKE :s OR u.lastName ILIKE :s OR u.email ILIKE :s
          OR CONCAT(u.firstName, ' ', u.lastName) ILIKE :s)`,
        { s: `%${query.search}%` },
      );
    }

    qb.orderBy('u.firstName', 'ASC').addOrderBy('u.lastName', 'ASC');

    const data = await qb.getMany();
    return { data, meta: { total: data.length } };
  }

  async findDoctors(clinicId: string) {
    const data = await this.usersRepo.find({
      where: { clinicId, role: 'doctor' as any, isActive: true },
      order: { firstName: 'ASC' },
      select: ['id', 'firstName', 'lastName', 'specialization', 'consultationFee', 'avatarUrl'],
    });
    return { data };
  }

  async findOne(id: string, clinicId: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id, clinicId } });
    if (!user) throw new NotFoundException('Staff member not found');
    return user;
  }

  async updateStaff(id: string, dto: UpdateStaffDto, clinicId: string): Promise<User> {
    const staff = await this.findOne(id, clinicId);
    Object.assign(staff, dto);
    return this.usersRepo.save(staff);
  }

  async createLeave(userId: string, dto: CreateLeaveDto): Promise<StaffLeave> {
    const leave = this.leavesRepo.create({
      ...dto,
      userId,
      status: LeaveStatus.PENDING,
    });
    return this.leavesRepo.save(leave);
  }

  async getLeaves(requesterId: string, requesterRole: string, userId?: string) {
    const qb = this.leavesRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.user', 'u')
      .orderBy('l.createdAt', 'DESC');

    if (requesterRole === 'admin') {
      if (userId) qb.where('l.userId = :userId', { userId });
    } else {
      qb.where('l.userId = :userId', { userId: requesterId });
    }

    const data = await qb.getMany();
    return { data };
  }

  async updateLeaveStatus(
    id: string,
    status: LeaveStatus,
    approvedById: string,
  ): Promise<StaffLeave> {
    const leave = await this.leavesRepo.findOne({ where: { id } });
    if (!leave) throw new NotFoundException('Leave request not found');

    leave.status = status;
    if (status === LeaveStatus.APPROVED) {
      leave.approvedBy = approvedById;
    }
    return this.leavesRepo.save(leave);
  }
}
