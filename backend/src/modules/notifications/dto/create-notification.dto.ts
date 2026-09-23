import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationPriority, NotificationType } from '@prisma/client';

export class CreateNotificationDto {
  @ApiProperty({ description: 'Tiêu đề thông báo', example: 'Họp toàn ban chuẩn bị Hackathon' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Nội dung chi tiết thông báo' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    enum: NotificationType,
    description: 'Phân loại thông báo',
    default: NotificationType.BROADCAST,
  })
  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType = NotificationType.BROADCAST;

  @ApiPropertyOptional({
    enum: NotificationPriority,
    description: 'Mức độ ưu tiên',
    default: NotificationPriority.NORMAL,
  })
  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority = NotificationPriority.NORMAL;

  @ApiPropertyOptional({
    description: 'Mã ban nhận thông báo (ví dụ: TECH_AI, HR_EVENT) hoặc "all" để phát toàn CLB',
    default: 'all',
  })
  @IsString()
  @IsOptional()
  targetDepartmentCode?: string = 'all';

  @ApiPropertyOptional({
    description: 'Link điều hướng khi nhấn vào thông báo trong Portal',
    example: '/app/events',
  })
  @IsString()
  @IsOptional()
  link?: string;
}
