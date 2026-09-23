import { EventType } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryEventDto {
  @ApiPropertyOptional({
    description: 'Lọc theo ID nhiệm kỳ (UUID). Mặc định là nhiệm kỳ active gần nhất.',
  })
  @IsOptional()
  @IsString()
  tenureId?: string;

  @ApiPropertyOptional({
    description: 'Chỉ lấy sự kiện public hiển thị trên Landing Page',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({
    enum: EventType,
    description: 'Phân loại sự kiện (WORKSHOP, HACKATHON, SHOWCASE, FLAGSHIP...)',
  })
  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  @ApiPropertyOptional({
    description: 'Trạng thái sự kiện (upcoming, registration_open, completed)',
    enum: ['upcoming', 'registration_open', 'completed'],
  })
  @IsOptional()
  @IsString()
  status?: 'upcoming' | 'registration_open' | 'completed';

  @ApiPropertyOptional({
    description: 'Tìm kiếm theo tiêu đề hoặc địa điểm sự kiện',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
