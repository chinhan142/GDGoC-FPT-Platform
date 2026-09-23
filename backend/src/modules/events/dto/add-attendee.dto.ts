import { CheckinMethod } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class AddAttendeeDto {
  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID người dùng nếu là thành viên CLB',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    example: 'Nguyễn Văn Khách',
    description: 'Họ tên khách mời / sinh viên ngoài CLB',
  })
  @IsOptional()
  @IsString()
  guestName?: string;

  @ApiPropertyOptional({
    example: 'SE189999',
    description: 'Mã số sinh viên (nếu có)',
  })
  @IsOptional()
  @IsString()
  guestMssv?: string;

  @ApiPropertyOptional({
    example: 'guestse189999@fpt.edu.vn',
    description: 'Email liên hệ của khách mời',
  })
  @IsOptional()
  @IsEmail()
  guestEmail?: string;

  @ApiPropertyOptional({
    example: 'Ban Kỹ thuật',
    description: 'Khoa / Đơn vị / Ban của khách',
  })
  @IsOptional()
  @IsString()
  guestDepartment?: string;

  @ApiPropertyOptional({
    enum: CheckinMethod,
    default: CheckinMethod.MANUAL_EVIDENCE,
    description: 'Phương thức điểm danh',
  })
  @IsOptional()
  @IsEnum(CheckinMethod)
  checkinMethod?: CheckinMethod = CheckinMethod.MANUAL_EVIDENCE;

  @ApiPropertyOptional({
    default: true,
    description: 'Đã được BCN / HR-Event xác thực có mặt',
  })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean = true;

  @ApiPropertyOptional({
    example: 'Đến tham dự đúng giờ tại sảnh bàn A',
    description: 'Ghi chú bổ sung',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
