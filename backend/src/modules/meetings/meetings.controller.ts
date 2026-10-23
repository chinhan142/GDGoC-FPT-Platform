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
import { DispatchMeetingDto, GenerateMeetDto } from './dto/dispatch-meeting.dto';
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

  @Post('generate-meet')
  @Roles(Role.LEAD, Role.ADVISOR, Role.ADMIN, Role.DEPARTMENT_LEAD)
  @ApiOperation({
    summary: 'Tự động sinh link Google Meet qua Google Calendar API',
  })
  @ApiResponse({ status: 200, description: 'Tạo link Google Meet' })
  async generateMeet(@Body() dto: GenerateMeetDto) {
    const meetUrl = await this.meetingsService.generateGoogleMeetLink({
      title: dto.title,
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
      attendeeEmails: dto.attendeeEmails,
      description: dto.description,
    });

    if (meetUrl) {
      return {
        success: true,
        meetingUrl: meetUrl,
        message: 'Đã tự động tạo link Google Meet thành công!',
      };
    }

    return {
      success: false,
      meetingUrl: null,
      message: 'Google Calendar API chưa được cấu hình credentials trong .env.',
    };
  }
}
