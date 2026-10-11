import { DepartmentType, MemberStatus, Role } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  academicYear?: string;

  @IsOptional()
  @IsString()
  gen?: string;
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() mssv?: string;
  @IsOptional() @IsEmail() email?: string;

  @ApiPropertyOptional({
    enum: Role,
    description: 'Vai trò của thành viên trong nhiệm kỳ',
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    enum: MemberStatus,
    description: 'Trạng thái hoạt động (ACTIVE, PROBATION, ON_LEAVE, ALUMNI)',
  })
  @IsOptional()
  @IsEnum(MemberStatus)
  status?: MemberStatus;

  @ApiPropertyOptional({
    example: 'Technical Lead',
    description: 'Chức danh hiển thị',
  })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({
    enum: DepartmentType,
    description: 'Ban chuyên môn phân bổ',
  })
  @IsOptional()
  @IsEnum(DepartmentType)
  departmentCode?: DepartmentType;
}
