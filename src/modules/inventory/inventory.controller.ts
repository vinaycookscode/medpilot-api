import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateItemDto } from './dto/create-item.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create inventory item' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateItemDto) {
    return this.inventoryService.create(user.clinicId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all inventory items with optional filters' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: InventoryQueryDto) {
    return this.inventoryService.findAll(user.clinicId, query);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get distinct item categories' })
  getCategories(@CurrentUser() user: JwtPayload) {
    return this.inventoryService.getCategories(user.clinicId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single item' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.inventoryService.findById(id, user.clinicId);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update item details' })
  update(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: Partial<CreateItemDto>) {
    return this.inventoryService.update(id, user.clinicId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete item' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.inventoryService.remove(id, user.clinicId);
  }

  @Post(':id/adjust')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Adjust stock (IN / OUT / ADJUSTMENT)' })
  adjustStock(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: AdjustStockDto) {
    return this.inventoryService.adjustStock(id, user.clinicId, dto, user.sub);
  }

  @Get(':id/transactions')
  @ApiOperation({ summary: 'Get stock transaction history for an item' })
  getTransactions(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.inventoryService.getTransactions(id, user.clinicId);
  }
}
