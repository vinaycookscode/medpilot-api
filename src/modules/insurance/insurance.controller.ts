import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InsuranceService } from './insurance.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { CreateClaimDto } from './dto/create-claim.dto';
import { UpdateClaimDto } from './dto/update-claim.dto';
import { QueryClaimsDto } from './dto/query-claims.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('insurance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('insurance')
export class InsuranceController {
  constructor(private readonly insuranceService: InsuranceService) {}

  @Get('providers')
  @ApiOperation({ summary: 'List active insurance providers' })
  async findProviders(@CurrentUser() user: JwtPayload) {
    const data = await this.insuranceService.findProviders(user.clinicId);
    return { success: true, data };
  }

  @Post('providers')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Add a new insurance provider (admin only)' })
  async createProvider(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateProviderDto,
  ) {
    const data = await this.insuranceService.createProvider(user.clinicId, dto);
    return { success: true, data, message: 'Insurance provider created' };
  }

  @Post('claims')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Create a new insurance claim' })
  async createClaim(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateClaimDto,
  ) {
    const data = await this.insuranceService.createClaim(user.clinicId, dto);
    return { success: true, data, message: 'Insurance claim created' };
  }

  @Get('claims/stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get claim statistics (admin only)' })
  async getClaimStats(@CurrentUser() user: JwtPayload) {
    const data = await this.insuranceService.getClaimStats(user.clinicId);
    return { success: true, data };
  }

  @Get('claims')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'List insurance claims with filters and pagination' })
  async findClaims(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryClaimsDto,
  ) {
    const result = await this.insuranceService.findClaims(user.clinicId, query);
    return { success: true, ...result };
  }

  @Get('claims/:id')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Get insurance claim by ID' })
  async findClaimById(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.insuranceService.findClaimById(id, user.clinicId);
    return { success: true, data };
  }

  @Patch('claims/:id')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Update insurance claim status and details' })
  async updateClaim(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateClaimDto,
  ) {
    const data = await this.insuranceService.updateClaim(id, user.clinicId, dto);
    return { success: true, data, message: 'Insurance claim updated' };
  }
}
