import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from './enums/user-role.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  async create(clinicId: string, dto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepo.findOne({
      where: { email: dto.email, clinicId },
    });
    if (existing) throw new ConflictException('Email already registered in this clinic');

    const user = this.usersRepo.create({
      ...dto,
      clinicId,
      passwordHash: dto.password,
    });
    return this.usersRepo.save(user);
  }

  async findAll(clinicId: string, role?: UserRole): Promise<User[]> {
    const where: Record<string, unknown> = { clinicId };
    if (role) where['role'] = role;
    return this.usersRepo.find({
      where: where as any,
      order: { firstName: 'ASC' },
    });
  }

  async findDoctors(clinicId: string): Promise<User[]> {
    return this.findAll(clinicId, UserRole.DOCTOR);
  }

  async findById(id: string, clinicId: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id, clinicId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, clinicId: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id, clinicId);
    Object.assign(user, dto);
    return this.usersRepo.save(user);
  }

  async deactivate(id: string, clinicId: string, requesterId: string): Promise<User> {
    if (id === requesterId) throw new ForbiddenException('Cannot deactivate your own account');
    const user = await this.findById(id, clinicId);
    user.isActive = false;
    return this.usersRepo.save(user);
  }

  async activate(id: string, clinicId: string): Promise<User> {
    const user = await this.findById(id, clinicId);
    user.isActive = true;
    return this.usersRepo.save(user);
  }
}
