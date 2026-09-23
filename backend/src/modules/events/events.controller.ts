import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { AddEventOrganizerDto } from './dto/add-event-organizer.dto';
import { QueryEventDto } from './dto/query-event.dto';
import { AddAttendeeDto } from './dto/add-attendee.dto';
import { ToggleCheckinDto } from './dto/toggle-checkin.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { HrEventGuard } from './guards/hr-event.guard';
import { Role } from '@prisma/client';

@ApiTags('Events & Attendance')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách sự kiện (Hỗ trợ lọc theo kỳ, trạng thái, public)',
  })
  @ApiOkResponse({ description: 'Danh sách sự kiện và bộ đếm người tham gia.' })
  findAll(@Query() query: QueryEventDto) {
    return this.eventsService.findAll(query);
  }

  @ApiCookieAuth('session_token')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, HrEventGuard)
  @Post()
  @ApiOperation({
    summary: 'Tạo sự kiện mới (Chỉ LEAD hoặc Trưởng ban HR_EVENT)',
  })
  @ApiCreatedResponse({ description: 'Sự kiện đã được tạo thành công.' })
  create(@Body() createEventDto: CreateEventDto) {
    return this.eventsService.create(createEventDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết sự kiện theo ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Thông tin chi tiết sự kiện.' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.eventsService.findOne(id);
  }

  @ApiCookieAuth('session_token')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, HrEventGuard)
  @Put(':id')
  @ApiOperation({
    summary: 'Cập nhật sự kiện (Chỉ LEAD hoặc Trưởng ban HR_EVENT)',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Cập nhật sự kiện thành công.' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateEventDto: UpdateEventDto,
  ) {
    return this.eventsService.update(id, updateEventDto);
  }

  @ApiCookieAuth('session_token')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LEAD)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa sự kiện (Chỉ LEAD)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Sự kiện đã được xóa thành công.' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.eventsService.remove(id);
  }

  // ==========================================
  // ATTENDEES & CHECK-IN ENDPOINTS
  // ==========================================

  @ApiCookieAuth('session_token')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id/attendees')
  @ApiOperation({
    summary: 'Lấy danh sách người tham dự & tỷ lệ điểm danh của sự kiện',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Danh sách người tham dự và thống kê.' })
  getAttendees(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.eventsService.getAttendees(id);
  }

  @ApiCookieAuth('session_token')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, HrEventGuard)
  @Post(':id/attendees')
  @ApiOperation({
    summary: 'Thêm người tham dự / Check-in thủ công tại bàn (Chỉ LEAD & Ban HR_EVENT)',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiCreatedResponse({ description: 'Ghi nhận tham dự thành công.' })
  addAttendee(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AddAttendeeDto,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.eventsService.addAttendee(id, dto, currentUserId);
  }

  @ApiCookieAuth('session_token')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, HrEventGuard)
  @Patch(':id/attendees/:attendeeId/checkin')
  @ApiOperation({
    summary: 'Toggle trạng thái điểm danh (Chỉ LEAD & Ban HR_EVENT)',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiParam({ name: 'attendeeId', type: String })
  @ApiOkResponse({ description: 'Cập nhật trạng thái điểm danh thành công.' })
  toggleCheckin(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('attendeeId') attendeeId: string,
    @Body() dto: ToggleCheckinDto,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.eventsService.toggleCheckin(id, attendeeId, dto, currentUserId);
  }

  @ApiCookieAuth('session_token')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, HrEventGuard)
  @Delete(':id/attendees/:attendeeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Xóa người tham dự khỏi sự kiện (Chỉ LEAD & Ban HR_EVENT)',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiParam({ name: 'attendeeId', type: String })
  @ApiNoContentResponse({ description: 'Đã xóa người tham dự thành công.' })
  async removeAttendee(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('attendeeId') attendeeId: string,
  ): Promise<void> {
    await this.eventsService.removeAttendee(id, attendeeId);
  }

  // ==========================================
  // ORGANIZERS ENDPOINTS
  // ==========================================

  @ApiCookieAuth('session_token')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, HrEventGuard)
  @Post(':eventId/organizers')
  @ApiOperation({ summary: 'Phân công thành viên Ban Tổ Chức (BTC)' })
  @ApiParam({ name: 'eventId', type: String, format: 'uuid' })
  addOrganizer(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body() addEventOrganizerDto: AddEventOrganizerDto,
  ) {
    return this.eventsService.addOrganizer(eventId, addEventOrganizerDto);
  }

  @Get(':eventId/organizers')
  @ApiOperation({ summary: 'Lấy danh sách BTC của sự kiện' })
  @ApiParam({ name: 'eventId', type: String, format: 'uuid' })
  findOrganizers(@Param('eventId', new ParseUUIDPipe()) eventId: string) {
    return this.eventsService.findOrganizers(eventId);
  }

  @ApiCookieAuth('session_token')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, HrEventGuard)
  @Delete(':eventId/organizers/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa thành viên khỏi BTC sự kiện' })
  @ApiParam({ name: 'eventId', type: String, format: 'uuid' })
  @ApiParam({ name: 'userId', type: String, format: 'uuid' })
  async removeOrganizer(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<void> {
    await this.eventsService.removeOrganizer(eventId, userId);
  }

  @ApiCookieAuth('session_token')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LEAD)
  @Post(':eventId/organizers/settle-gems')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Quyết toán Gems cho Ban Tổ Chức sự kiện (Chỉ LEAD)',
  })
  @ApiParam({ name: 'eventId', type: String, format: 'uuid' })
  settleOrganizerGems(@Param('eventId', new ParseUUIDPipe()) eventId: string) {
    return this.eventsService.settleOrganizerGems(eventId);
  }
}
