import {
  Query,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  SerializeOptions,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { ObjectIdPipe } from '@/shared/pipes/object-id.pipe';
import { PeriodsService } from './periods.service';
import { Period } from './schemas/periods.schema';
import { Permissions } from '@/auth/decorators/permissions.decorator';
import { Permission } from '@/auth/enums/permission.enum';
import { MongooseClassSerializerInterceptor } from '@/shared/mongoose-class-serializer.interceptor';
import { PeriodPaginatedResponseDto } from './dto/period-paginated-response.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { Praise } from '@/praise/schemas/praise.schema';
import { PaginatedQueryDto } from '@/shared/dto/pagination-query.dto';
import { CreatePeriodInputDto } from './dto/create-period-input.dto';
import { UpdatePeriodInputDto } from './dto/update-period-input.dto';
import { VerifyQuantifierPoolSizeDto } from './dto/verify-quantifiers-pool-size.dto';
import { PeriodDetailsDto } from './dto/period-details.dto';
import {
  PeriodReplaceQuantifierInputDto,
  ReplaceQuantifierInputDto,
} from './dto/replace-quantifier-input.dto';
import { PeriodReplaceQuantifierResponseDto } from './dto/replace-quantifier-reponse.dto';

@Controller('periods')
@ApiTags('Periods')
@SerializeOptions({
  excludePrefixes: ['__'],
})
@UseGuards(PermissionsGuard)
@UseGuards(JwtAuthGuard)
@UseInterceptors(MongooseClassSerializerInterceptor(Period))
export class PeriodsController {
  constructor(private readonly periodsService: PeriodsService) {}

  @Get()
  @ApiOperation({ summary: 'List all periods' })
  @ApiResponse({
    status: 200,
    description: 'Periods',
    type: PeriodPaginatedResponseDto,
  })
  @Permissions(Permission.PeriodView)
  async findAllPaginated(
    @Query() options: PaginatedQueryDto,
  ): Promise<PeriodPaginatedResponseDto> {
    return this.periodsService.findAllPaginated(options);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find period by id' })
  @ApiResponse({
    status: 200,
    description: 'Period',
    type: Period,
  })
  @Permissions(Permission.PeriodView)
  @ApiParam({ name: 'id', type: String })
  async findOne(
    @Param('id', ObjectIdPipe) id: Types.ObjectId,
  ): Promise<Period> {
    return this.periodsService.findPeriodDetails(id);
  }

  @Post('/')
  @ApiOperation({ summary: 'Create a new period' })
  @ApiResponse({
    status: 200,
    description: 'Period',
    type: Period,
  })
  @Permissions(Permission.PeriodCreate)
  async create(@Body() createPeriodDto: CreatePeriodInputDto): Promise<Period> {
    return this.periodsService.create(createPeriodDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a period' })
  @ApiResponse({
    status: 200,
    description: 'Period',
    type: Period,
  })
  @Permissions(Permission.PeriodUpdate)
  @ApiParam({ name: 'id', type: String })
  async update(
    @Param('id', ObjectIdPipe) id: Types.ObjectId,
    @Body() updatePeriodDto: UpdatePeriodInputDto,
  ): Promise<Period> {
    return this.periodsService.update(id, updatePeriodDto);
  }

  @Patch(':id/close')
  @ApiOperation({ summary: 'Close a period' })
  @ApiResponse({
    status: 200,
    description: 'Period',
    type: Period,
  })
  @Permissions(Permission.PeriodUpdate)
  @ApiParam({ name: 'id', type: String })
  async close(@Param('id', ObjectIdPipe) id: Types.ObjectId): Promise<Period> {
    return this.periodsService.close(id);
  }

  @Get(':id/praise')
  @ApiOperation({ summary: 'Fetch all Praise in a period' })
  @ApiResponse({
    status: 200,
    description: 'Period Praise items',
    type: [Praise],
  })
  @Permissions(Permission.PeriodView)
  @ApiParam({ name: 'id', type: String })
  async praise(
    @Param('id', ObjectIdPipe) id: Types.ObjectId,
  ): Promise<Praise[]> {
    return this.periodsService.praise(id);
  }

  @Get(':id/verifyQuantifierPoolSize')
  @ApiOperation({ summary: 'Verify quantifier pool size' })
  @ApiResponse({
    status: 200,
    description: 'Period',
    type: Period,
  })
  @Permissions(Permission.PeriodAssign)
  @ApiParam({ name: 'id', type: String })
  async verifyQuantifierPoolSize(
    @Param('id', ObjectIdPipe) id: Types.ObjectId,
  ): Promise<VerifyQuantifierPoolSizeDto> {
    return this.periodsService.verifyQuantifierPoolSize(id);
  }

  @Patch(':id/assignQuantifiers')
  @ApiOperation({ summary: 'Assign quantifiers to period' })
  @ApiResponse({
    status: 200,
    description: 'Period',
    type: Period,
  })
  @Permissions(Permission.PeriodAssign)
  @ApiParam({ name: 'id', type: String })
  async assignQuantifiers(
    @Param('id', ObjectIdPipe) id: Types.ObjectId,
  ): Promise<PeriodDetailsDto> {
    return this.periodsService.assignQuantifiers(id);
  }

  @Patch(':id/replaceQuantifier')
  @ApiOperation({ summary: 'Replace quantifier in period' })
  @ApiResponse({
    status: 200,
    description: 'Period',
    type: Period,
  })
  @Permissions(Permission.PeriodAssign)
  @ApiParam({ name: 'id', type: String })
  async replaceQuantifier(
    @Param('id', ObjectIdPipe) id: Types.ObjectId,
    @Body() replaceQuantifierDto: PeriodReplaceQuantifierInputDto,
  ): Promise<PeriodReplaceQuantifierResponseDto> {
    return this.periodsService.replaceQuantifier(id, replaceQuantifierDto);
  }
}
