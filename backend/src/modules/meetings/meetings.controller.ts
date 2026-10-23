import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MeetingsService } from './meetings.service';
import { DispatchMeetingDto } from './dto/dispatch-meeting.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Meetings Dispatcher (Công Cụ Thiết Lập Lịch Họp)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post('dispatch')
  @Roles(Role.LEAD, Role.ADVISOR, Role.ADMIN, Role.DEPARTMENT_LEAD)
  @ApiOperation({
    summary: 'Thiết lập và phát lịch họp cho Leader (Tạo thông báo in-app & gửi email lịch Google Calendar)',
  })
  @ApiResponse({ status: 201, description: 'Lịch họp đã được gửi thành công.' })
  dispatch(
    @CurrentUser() sender: any,
    @Body() dto: DispatchMeetingDto,
  ) {
    return this.meetingsService.dispatchMeeting(sender, dto);
  }
}
