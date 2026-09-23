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
import { GiftsService } from './gifts.service';
import { CreateGiftDto } from './dto/create-gift.dto';
import { UpdateGiftDto } from './dto/update-gift.dto';
import { RedeemGiftDto } from './dto/redeem-gift.dto';
import { QueryRedemptionsDto } from './dto/query-redemptions.dto';
import { UpdateRedemptionStatusDto } from './dto/update-redemption-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';

@ApiTags('Gift Shop & Redemptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gifts')
export class GiftsController {
  constructor(private readonly giftsService: GiftsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh mục quà tặng khả dụng' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách quà tặng thành công.' })
  findAll() {
    return this.giftsService.findAllGifts();
  }

  @Get('redemptions')
  @ApiOperation({
    summary:
      'Lấy danh sách yêu cầu đổi quà (Thành viên xem đơn của mình, BCN xem tất cả)',
  })
  findRedemptions(
    @GetUser() user: any,
    @Query() query: QueryRedemptionsDto,
  ) {
    return this.giftsService.findRedemptions(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem thông tin chi tiết một món quà' })
  findOne(@Param('id') id: string) {
    return this.giftsService.findOneGift(id);
  }

  @Post()
  @Roles(Role.LEAD)
  @ApiOperation({ summary: 'Thêm món quà tặng mới vào kho (Chỉ BCN)' })
  @ApiResponse({ status: 201, description: 'Tạo quà tặng thành công.' })
  createGift(@Body() dto: CreateGiftDto) {
    return this.giftsService.createGift(dto);
  }

  @Put(':id')
  @Roles(Role.LEAD)
  @ApiOperation({ summary: 'Cập nhật thông tin quà tặng (Chỉ BCN)' })
  updateGift(@Param('id') id: string, @Body() dto: UpdateGiftDto) {
    return this.giftsService.updateGift(id, dto);
  }

  @Delete(':id')
  @Roles(Role.LEAD)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa món quà tặng khỏi danh mục (Chỉ BCN)' })
  removeGift(@Param('id') id: string) {
    return this.giftsService.removeGift(id);
  }

  @Post('redeem')
  @ApiOperation({
    summary: 'Gửi yêu cầu đổi quà tặng (Trừ Gems & tồn kho nguyên tử)',
  })
  @ApiResponse({ status: 201, description: 'Đổi quà thành công.' })
  redeemGift(@GetUser('id') userId: string, @Body() dto: RedeemGiftDto) {
    return this.giftsService.redeemGift(userId, dto);
  }

  @Patch('redemptions/:id/status')
  @Roles(Role.LEAD)
  @ApiOperation({
    summary:
      'Phê duyệt / Từ chối đơn đổi quà (Tự động hoàn Gems & tồn kho nếu REJECTED)',
  })
  updateRedemptionStatus(
    @GetUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRedemptionStatusDto,
  ) {
    return this.giftsService.updateRedemptionStatus(adminId, id, dto);
  }
}
