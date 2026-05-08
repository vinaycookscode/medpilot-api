import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { LabTestCatalog } from './entities/lab-test-catalog.entity';
import { LabOrder, LabOrderStatus } from './entities/lab-order.entity';
import { LabOrderItem } from './entities/lab-order-item.entity';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { UpdateLabResultDto } from './dto/update-lab-result.dto';
import { QueryLabsDto } from './dto/query-labs.dto';
import { CreateTestCatalogDto } from './dto/create-test-catalog.dto';

@Injectable()
export class LabsService {
  constructor(
    @InjectRepository(LabTestCatalog) private catalogRepo: Repository<LabTestCatalog>,
    @InjectRepository(LabOrder) private ordersRepo: Repository<LabOrder>,
    @InjectRepository(LabOrderItem) private itemsRepo: Repository<LabOrderItem>,
  ) {}

  async createOrder(clinicId: string, orderedById: string, dto: CreateLabOrderDto): Promise<LabOrder> {
    const tests = await this.catalogRepo.findBy({ id: In(dto.testIds), clinicId, isActive: true });
    if (tests.length !== dto.testIds.length) {
      throw new BadRequestException('One or more test IDs are invalid or inactive');
    }

    const order = this.ordersRepo.create({
      clinicId,
      orderedById,
      patientId: dto.patientId,
      appointmentId: dto.appointmentId ?? null,
      notes: dto.notes ?? null,
      status: LabOrderStatus.PENDING,
    });
    const savedOrder = await this.ordersRepo.save(order);

    const items = tests.map((test) =>
      this.itemsRepo.create({
        labOrderId: savedOrder.id,
        testId: test.id,
        normalRange: test.normalRange,
        unit: test.unit,
      }),
    );
    await this.itemsRepo.save(items);

    return this.findOrderById(savedOrder.id, clinicId);
  }

  async findOrders(clinicId: string, query: QueryLabsDto) {
    const qb = this.ordersRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.patient', 'patient')
      .leftJoinAndSelect('o.orderedBy', 'orderedBy')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.test', 'test')
      .where('o.clinicId = :clinicId', { clinicId })
      .andWhere('o.deletedAt IS NULL');

    if (query.patientId) {
      qb.andWhere('o.patientId = :patientId', { patientId: query.patientId });
    }
    if (query.status) {
      qb.andWhere('o.status = :status', { status: query.status });
    }
    if (query.from) {
      qb.andWhere('o.createdAt >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('o.createdAt <= :to', { to: query.to });
    }

    qb.orderBy('o.createdAt', 'DESC');

    const total = await qb.getCount();
    const data = await qb.skip(query.skip).take(query.limit).getMany();

    return { data, meta: { total, page: query.page, limit: query.limit } };
  }

  async findOrderById(id: string, clinicId: string): Promise<LabOrder> {
    const order = await this.ordersRepo.findOne({
      where: { id, clinicId },
      relations: ['patient', 'orderedBy', 'items', 'items.test'],
    });
    if (!order) throw new NotFoundException('Lab order not found');
    return order;
  }

  async updateResults(id: string, clinicId: string, dto: UpdateLabResultDto): Promise<LabOrder> {
    const order = await this.findOrderById(id, clinicId);

    if (order.status === LabOrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot update results for a cancelled order');
    }

    for (const update of dto.items) {
      const item = order.items.find((i) => i.id === update.itemId);
      if (!item) throw new NotFoundException(`Item ${update.itemId} not found in this order`);

      if (update.result !== undefined) item.result = update.result;
      if (update.isAbnormal !== undefined) item.isAbnormal = update.isAbnormal;
      if (update.remarks !== undefined) item.remarks = update.remarks;

      await this.itemsRepo.save(item);
    }

    order.status = LabOrderStatus.COMPLETED;
    order.completedAt = new Date();
    await this.ordersRepo.save(order);

    return this.findOrderById(id, clinicId);
  }

  async cancelOrder(id: string, clinicId: string): Promise<LabOrder> {
    const order = await this.findOrderById(id, clinicId);

    if (order.status === LabOrderStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed order');
    }
    if (order.status === LabOrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already cancelled');
    }

    order.status = LabOrderStatus.CANCELLED;
    await this.ordersRepo.save(order);

    return this.findOrderById(id, clinicId);
  }

  async createTestCatalog(clinicId: string, dto: CreateTestCatalogDto): Promise<LabTestCatalog> {
    const test = this.catalogRepo.create({ ...dto, clinicId });
    return this.catalogRepo.save(test);
  }

  async findTestCatalog(clinicId: string): Promise<LabTestCatalog[]> {
    return this.catalogRepo.find({
      where: { clinicId, isActive: true },
      order: { category: 'ASC', name: 'ASC' },
    });
  }
}
