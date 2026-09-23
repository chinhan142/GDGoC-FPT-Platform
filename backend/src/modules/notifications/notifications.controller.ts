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
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
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

@ApiTags('Notifications Center (Trung Tâm Thông Báo)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách thông báo của người dùng hiện tại (Kèm số chưa đọc)',
  })
  @ApiResponse({ status: 200, description: 'Lấy thông báo thành công.' })
  findAll(
    @GetUser() user: any,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationsService.findAllForUser(user, query);
  }

  @Post()
  @Roles(Role.LEAD, Role.DEPARTMENT_LEAD)
  @ApiOperation({
    summary: 'Phát thông báo mới (Broadcast toàn CLB hoặc theo Ban)',
  })
  @ApiResponse({ status: 201, description: 'Tạo thông báo thành công.' })
  create(
    @GetUser() sender: any,
    @Body() dto: CreateNotificationDto,
  ) {
    return this.notificationsService.create(sender, dto);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Đánh dấu đã đọc tất cả thông báo' })
  @ApiResponse({ status: 200, description: 'Đã đánh dấu tất cả là đã đọc.' })
  markAllAsRead(@GetUser() user: any) {
    return this.notificationsService.markAllAsRead(user);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Đánh dấu đã đọc một thông báo' })
  @ApiResponse({ status: 200, description: 'Đã đánh dấu thông báo là đã đọc.' })
  markAsRead(
    @GetUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa thông báo (Chỉ BCN hoặc Người gửi)' })
  remove(
    @GetUser() user: any,
    @Param('id') id: string,
  ) {
    return this.notificationsService.remove(user, id);
  }
}
