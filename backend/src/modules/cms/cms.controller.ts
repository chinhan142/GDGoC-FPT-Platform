import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { CmsService } from './cms.service';
import { UpdateStatsDto } from './dto/update-stats.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';

@ApiTags('Landing Page CMS')
@Controller('cms')
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get('stats')
  @ApiOperation({
    summary:
      'Lấy số liệu milestone thống kê tác động hiển thị trên Landing Page (Public)',
  })
  @ApiResponse({ status: 200, description: 'Lấy số liệu thống kê thành công.' })
  getStats() {
    return this.cmsService.getStats();
  }

  @Get('events')
  @ApiOperation({
    summary: 'Lấy danh sách sự kiện công khai trên Landing Page (Public)',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách sự kiện thành công.' })
  getEvents() {
    return this.cmsService.getPublicEvents();
  }

  @Put('stats')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LEAD)
  @ApiOperation({
    summary: 'Cập nhật số liệu milestone hiển thị trên Landing Page (Chỉ BCN)',
  })
  @ApiResponse({ status: 200, description: 'Cập nhật số liệu thành công.' })
  updateStats(@Body() dto: UpdateStatsDto) {
    return this.cmsService.updateStats(dto);
  }
}
