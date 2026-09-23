import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { InventoryGuard } from './guards/inventory.guard';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Inventory Management (Kho Vật Tư)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, InventoryGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({
    summary:
      'Lấy danh sách vật tư / tài sản CLB (Quyền: LEAD, ADVISOR, HR_EVENT)',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách vật tư thành công.' })
  findAll(@Query() query: QueryInventoryDto) {
    return this.inventoryService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem thông tin chi tiết một món vật tư' })
  findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Thêm vật tư / tài sản mới vào kho (Quyền: LEAD, HR_EVENT Lead)',
  })
  @ApiResponse({ status: 201, description: 'Tạo vật tư thành công.' })
  create(@Body() dto: CreateInventoryItemDto) {
    return this.inventoryService.create(dto);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Cập nhật thông tin vật tư (Quyền: LEAD, HR_EVENT Lead)',
  })
  updatePut(@Param('id') id: string, @Body() dto: UpdateInventoryItemDto) {
    return this.inventoryService.update(id, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Cập nhật một phần thông tin vật tư (Quyền: LEAD, HR_EVENT Lead)',
  })
  updatePatch(@Param('id') id: string, @Body() dto: UpdateInventoryItemDto) {
    return this.inventoryService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa vật tư khỏi kho (Chỉ BCN / LEAD)' })
  remove(@Param('id') id: string) {
    return this.inventoryService.remove(id);
  }
}
