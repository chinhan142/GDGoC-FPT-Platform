import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RedemptionStatus } from '@prisma/client';

export class QueryRedemptionsDto {
  @ApiPropertyOptional({
    enum: RedemptionStatus,
    description: 'Lọc theo trạng thái đơn đổi quà (PENDING, APPROVED, DELIVERED, REJECTED)',
  })
  @IsEnum(RedemptionStatus)
  @IsOptional()
  status?: RedemptionStatus;

  @ApiPropertyOptional({ description: 'Số trang (bắt đầu từ 1)', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Số lượng đơn trên mỗi trang',
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
