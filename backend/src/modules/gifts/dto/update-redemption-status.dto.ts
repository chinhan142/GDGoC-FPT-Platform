import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RedemptionStatus } from '@prisma/client';

export class UpdateRedemptionStatusDto {
  @ApiProperty({
    enum: RedemptionStatus,
    description: 'Trạng thái mới của đơn đổi quà (APPROVED, DELIVERED, REJECTED)',
  })
  @IsEnum(RedemptionStatus)
  @IsNotEmpty()
  status: RedemptionStatus;

  @ApiPropertyOptional({
    description: 'Ghi chú phê duyệt / lý do từ chối đơn',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
