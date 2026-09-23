import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DepartmentType, TaskPriority, TaskStatus } from '@prisma/client';

export class QueryTaskDto {
  @ApiPropertyOptional({
    enum: TaskStatus,
    description: 'Lọc theo trạng thái Task',
  })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiPropertyOptional({
    enum: TaskPriority,
    description: 'Lọc theo độ ưu tiên',
  })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiPropertyOptional({
    enum: DepartmentType,
    description: 'Lọc theo mã Ban chuyên môn (ví dụ: TECH_AI, TECH_WEB)',
  })
  @IsEnum(DepartmentType)
  @IsOptional()
  departmentCode?: DepartmentType;

  @ApiPropertyOptional({ description: 'Lọc theo ID Ban chuyên môn' })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID Niên khóa' })
  @IsString()
  @IsOptional()
  tenureId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID thành viên được phân công' })
  @IsString()
  @IsOptional()
  assigneeId?: string;

  @ApiPropertyOptional({
    description: 'Từ khóa tìm kiếm theo tiêu đề hoặc mô tả',
  })
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
    description: 'Số lượng mục trên mỗi trang',
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
