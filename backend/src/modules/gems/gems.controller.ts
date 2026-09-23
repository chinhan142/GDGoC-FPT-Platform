import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GemsService } from './gems.service';
import { QueryLeaderboardDto } from './dto/query-leaderboard.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { AdjustGemsDto } from './dto/adjust-gems.dto';
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

@ApiTags('Gems & Gamification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gems')
export class GemsController {
  constructor(private readonly gemsService: GemsService) {}

  @Get('leaderboard')
  @ApiOperation({
    summary: 'Bảng xếp hạng Gems vinh danh (Kèm mức tăng trưởng tuần)',
  })
  @ApiResponse({ status: 200, description: 'Lấy Leaderboard thành công.' })
  getLeaderboard(@Query() query: QueryLeaderboardDto) {
    return this.gemsService.getLeaderboard(query);
  }

  @Get('transactions')
  @ApiOperation({
    summary:
      'Lịch sử giao dịch sổ cái Gems (Cá nhân hoặc BCN xem của thành viên)',
  })
  @ApiResponse({ status: 200, description: 'Lấy lịch sử giao dịch thành công.' })
  getTransactions(@GetUser() user: any, @Query() query: QueryTransactionsDto) {
    return this.gemsService.getTransactions(user, query);
  }

  @Post('adjust')
  @Roles(Role.LEAD)
  @ApiOperation({
    summary: 'Điều chỉnh Gems thủ công (Khen thưởng / Phạt) - Chỉ BCN',
  })
  @ApiResponse({ status: 201, description: 'Điều chỉnh Gems thành công.' })
  adjustGems(@GetUser('id') adminId: string, @Body() dto: AdjustGemsDto) {
    return this.gemsService.adjustGems(adminId, dto);
  }
}
