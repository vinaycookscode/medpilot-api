import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LabsService } from './labs.service';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { UpdateLabResultDto } from './dto/update-lab-result.dto';
import { QueryLabsDto } from './dto/query-labs.dto';
import { CreateTestCatalogDto } from './dto/create-test-catalog.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('labs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('labs')
export class LabsController {
  constructor(private readonly labsService: LabsService) {}

  @Post('orders')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Create a new lab order' })
  async createOrder(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateLabOrderDto,
  ) {
    const data = await this.labsService.createOrder(user.clinicId, user.sub, dto);
    return { success: true, data, message: 'Lab order created successfully' };
  }

  @Get('orders')
  @ApiOperation({ summary: 'List lab orders with filters and pagination' })
  async findOrders(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryLabsDto,
  ) {
    const result = await this.labsService.findOrders(user.clinicId, query);
    return { success: true, ...result };
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get lab order by ID' })
  async findOrderById(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.labsService.findOrderById(id, user.clinicId);
    return { success: true, data };
  }

  @Patch('orders/:id/results')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update lab order item results' })
  async updateResults(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateLabResultDto,
  ) {
    const data = await this.labsService.updateResults(id, user.clinicId, dto);
    return { success: true, data, message: 'Lab results updated successfully' };
  }

  @Patch('orders/:id/cancel')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a lab order' })
  async cancelOrder(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.labsService.cancelOrder(id, user.clinicId);
    return { success: true, data, message: 'Lab order cancelled' };
  }

  @Get('catalog')
  @ApiOperation({ summary: 'Get active lab test catalog for dropdown' })
  async findCatalog(@CurrentUser() user: JwtPayload) {
    const data = await this.labsService.findTestCatalog(user.clinicId);
    return { success: true, data };
  }

  @Post('catalog')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Add a test to the lab catalog (admin only)' })
  async createCatalog(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTestCatalogDto,
  ) {
    const data = await this.labsService.createTestCatalog(user.clinicId, dto);
    return { success: true, data, message: 'Test catalog entry created' };
  }
}
