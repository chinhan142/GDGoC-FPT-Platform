import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DepartmentType } from '@prisma/client';

export class QueryLeaderboardDto {
  @ApiPropertyOptional({
    description: 'ID Niên khóa (Tenure UUID), mặc định lấy kỳ đang hoạt động',
  })
  @IsString()
  @IsOptional()
  tenureId?: string;

  @ApiPropertyOptional({
    enum: DepartmentType,
    description: 'Lọc bảng xếp hạng theo Ban chuyên môn (TECH_AI, TECH_WEB, v.v.)',
  })
  @IsEnum(DepartmentType)
  @IsOptional()
  departmentCode?: DepartmentType;

  @ApiPropertyOptional({
    description: 'Giới hạn số lượng top thành viên hiển thị',
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
