import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AccessLevel, DepartmentType, DriveCategory } from '@prisma/client';

export class QueryAssetsDto {
  @ApiPropertyOptional({
    enum: DriveCategory,
    description: 'Lọc theo danh mục tài nguyên',
  })
  @IsEnum(DriveCategory)
  @IsOptional()
  category?: DriveCategory;

  @ApiPropertyOptional({
    enum: DepartmentType,
    description: 'Lọc theo mã Ban chuyên môn',
  })
  @IsEnum(DepartmentType)
  @IsOptional()
  departmentCode?: DepartmentType;

  @ApiPropertyOptional({
    enum: AccessLevel,
    description: 'Lọc theo cấp độ quyền xem',
  })
  @IsEnum(AccessLevel)
  @IsOptional()
  accessLevel?: AccessLevel;

  @ApiPropertyOptional({ description: 'Lọc theo ID sự kiện' })
  @IsString()
  @IsOptional()
  eventId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID nhiệm kỳ' })
  @IsString()
  @IsOptional()
  tenureId?: string;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tên hoặc mô tả' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Số trang (bắt đầu từ 1)', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Số lượng tài nguyên trên mỗi trang',
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
