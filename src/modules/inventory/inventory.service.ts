import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryTransaction, TransactionType } from './entities/inventory-transaction.entity';
import { CreateItemDto } from './dto/create-item.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { InventoryQueryDto, StockFilter } from './dto/inventory-query.dto';
import { PartialType } from '@nestjs/swagger';
import { CreateItemDto as UpdateItemDto } from './dto/create-item.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem) private itemsRepo: Repository<InventoryItem>,
    @InjectRepository(InventoryTransaction) private txRepo: Repository<InventoryTransaction>,
  ) {}

  async create(clinicId: string, dto: CreateItemDto): Promise<InventoryItem> {
    const item = this.itemsRepo.create({ ...dto, clinicId });
    return this.itemsRepo.save(item);
  }

  async findAll(clinicId: string, query: InventoryQueryDto) {
    const qb = this.itemsRepo
      .createQueryBuilder('i')
      .where('i.clinicId = :clinicId', { clinicId })
      .andWhere('i.deletedAt IS NULL')
      .andWhere('i.isActive = true');

    if (query.search) {
      qb.andWhere('(i.name ILIKE :s OR i.manufacturer ILIKE :s)', { s: `%${query.search}%` });
    }
    if (query.category) {
      qb.andWhere('i.category = :category', { category: query.category });
    }
    if (query.stock === StockFilter.LOW) {
      qb.andWhere('i.quantity > 0 AND i.quantity <= i.reorderLevel');
    } else if (query.stock === StockFilter.OUT) {
      qb.andWhere('i.quantity <= 0');
    }

    const items = await qb.orderBy('i.name', 'ASC').getMany();

    const total     = items.length;
    const lowStock  = items.filter(i => Number(i.quantity) > 0 && Number(i.quantity) <= Number(i.reorderLevel)).length;
    const outStock  = items.filter(i => Number(i.quantity) <= 0).length;
    const categories = [...new Set(items.map(i => i.category))].sort();

    return { items, summary: { total, lowStock, outStock, categories } };
  }

  async findById(id: string, clinicId: string): Promise<InventoryItem> {
    const item = await this.itemsRepo.findOne({ where: { id, clinicId } });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async update(id: string, clinicId: string, dto: Partial<CreateItemDto>): Promise<InventoryItem> {
    const item = await this.findById(id, clinicId);
    Object.assign(item, dto);
    return this.itemsRepo.save(item);
  }

  async remove(id: string, clinicId: string): Promise<void> {
    const item = await this.findById(id, clinicId);
    await this.itemsRepo.softDelete(item.id);
  }

  async adjustStock(id: string, clinicId: string, dto: AdjustStockDto, userId: string) {
    const item = await this.findById(id, clinicId);
    const quantityBefore = Number(item.quantity);

    let quantityAfter: number;
    if (dto.type === TransactionType.IN) {
      quantityAfter = quantityBefore + dto.quantity;
    } else if (dto.type === TransactionType.OUT) {
      quantityAfter = Math.max(0, quantityBefore - dto.quantity);
    } else {
      quantityAfter = dto.quantity;
    }

    item.quantity = quantityAfter;
    await this.itemsRepo.save(item);

    const tx = this.txRepo.create({
      clinicId,
      itemId: id,
      type: dto.type,
      quantity: dto.quantity,
      quantityBefore,
      quantityAfter,
      note: dto.note,
      createdBy: userId,
    });
    await this.txRepo.save(tx);

    return item;
  }

  async getTransactions(itemId: string, clinicId: string) {
    return this.txRepo.find({
      where: { itemId, clinicId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getCategories(clinicId: string): Promise<string[]> {
    const result = await this.itemsRepo
      .createQueryBuilder('i')
      .select('DISTINCT i.category', 'category')
      .where('i.clinicId = :clinicId AND i.deletedAt IS NULL', { clinicId })
      .getRawMany();
    return result.map(r => r.category).sort();
  }
}
