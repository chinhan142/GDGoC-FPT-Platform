import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class QueryNotificationsDto {
  @ApiPropertyOptional({
    enum: NotificationType,
    description: 'Lọc theo phân loại thông báo (TASK, EVENT, GEMS, BROADCAST, SYSTEM)',
  })
  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  @ApiPropertyOptional({
    description: 'Chỉ lấy những thông báo chưa đọc (true / false)',
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ description: 'Số trang (bắt đầu từ 1)', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Số lượng thông báo trên mỗi trang',
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
