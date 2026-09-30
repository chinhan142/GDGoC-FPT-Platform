import { DepartmentType, MemberStatus, Role } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateMemberDto {
  @ApiPropertyOptional({
    description: 'Họ và tên thành viên',
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Mã số sinh viên (MSSV)',
  })
  @IsOptional()
  @IsString()
  mssv?: string;

  @ApiPropertyOptional({
    description: 'Email FPT của thành viên',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    description: 'Số điện thoại liên lạc',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

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

  @ApiPropertyOptional({
    description: 'ID Nhiệm kỳ (Tenure UUID)',
  })
  @IsOptional()
  @IsString()
  tenureId?: string;
}
