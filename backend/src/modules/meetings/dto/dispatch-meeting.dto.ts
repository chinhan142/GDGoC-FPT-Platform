import { IsNotEmpty, IsString, IsOptional, IsArray, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DispatchMeetingDto {
  @ApiProperty({ description: 'Tiêu đề cuộc họp', example: 'Họp Review Tiến Độ Tuần 4 - Ban Web & AI' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ description: 'Thời gian bắt đầu (ISO 8601)', example: '2026-10-25T19:30:00+07:00' })
  @IsNotEmpty()
  @IsDateString()
  startTime: string;

  @ApiProperty({ description: 'Thời gian kết thúc (ISO 8601)', example: '2026-10-25T21:00:00+07:00' })
  @IsNotEmpty()
  @IsDateString()
  endTime: string;

  @ApiPropertyOptional({ description: 'Địa điểm (e.g. Phòng 204 hoặc Google Meet)', example: 'Google Meet' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Link Google Meet', example: 'https://meet.google.com/abc-defg-hij' })
  @IsOptional()
  @IsString()
  meetingUrl?: string;

  @ApiPropertyOptional({ description: 'Nội dung / Agenda tóm tắt' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Loại người nhận: ALL (Toàn CLB) hoặc CUSTOM', example: 'CUSTOM' })
  @IsOptional()
  @IsString()
  targetType?: 'ALL' | 'CUSTOM';

  @ApiPropertyOptional({ description: 'Mã các ban nhận thông báo (ví dụ: TECH_AI, TECH_WEB, MEDIA)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetDepartmentCodes?: string[];

  @ApiPropertyOptional({ description: 'Danh sách ID thành viên được chọn cụ thể' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetUserIds?: string[];

  @ApiPropertyOptional({ description: 'Tự động gọi Google Calendar API để sinh link Meet', example: true })
  @IsOptional()
  autoGenerateMeet?: boolean;
}

export class GenerateMeetDto {
  @ApiProperty({ description: 'Tiêu đề cuộc họp', example: 'Họp Review Tiến Độ' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ description: 'Thời gian bắt đầu (ISO 8601)', example: '2026-10-25T19:30:00+07:00' })
  @IsNotEmpty()
  @IsDateString()
  startTime: string;

  @ApiProperty({ description: 'Thời gian kết thúc (ISO 8601)', example: '2026-10-25T21:00:00+07:00' })
  @IsNotEmpty()
  @IsDateString()
  endTime: string;

  @ApiPropertyOptional({ description: 'Ghi chú / Mô tả' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Danh sách email người tham dự' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attendeeEmails?: string[];
}

