import { DepartmentType, MemberStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryMembersDto {
  @ApiPropertyOptional({
    description: 'Lọc theo nhiệm kỳ (UUID). Mặc định là nhiệm kỳ active gần nhất.',
  })
  @IsOptional()
  @IsString()
  tenureId?: string;

  @ApiPropertyOptional({
    enum: DepartmentType,
    description: 'Lọc theo ban chuyên môn',
  })
  @IsOptional()
  @IsEnum(DepartmentType)
  departmentCode?: DepartmentType;

  @ApiPropertyOptional({
    enum: MemberStatus,
    description: 'Lọc theo trạng thái hoạt động của thành viên',
  })
  @IsOptional()
  @IsEnum(MemberStatus)
  status?: MemberStatus;

  @ApiPropertyOptional({
    description: 'Tìm kiếm theo Họ tên, MSSV hoặc Email',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Số trang (bắt đầu từ 1)',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Số lượng mục trên mỗi trang',
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}
