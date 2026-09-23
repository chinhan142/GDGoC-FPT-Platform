import { DepartmentType, Role } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ImportMembersDto {
  @ApiPropertyOptional({
    description: 'Nhiệm kỳ gán thành viên vào (nếu không truyền sẽ lấy kỳ active)',
  })
  @IsOptional()
  @IsString()
  tenureId?: string;

  @ApiPropertyOptional({
    enum: Role,
    default: Role.MEMBER,
    description: 'Vai trò mặc định nếu trong file không ghi rõ',
  })
  @IsOptional()
  @IsEnum(Role)
  defaultRole?: Role = Role.MEMBER;

  @ApiPropertyOptional({
    enum: DepartmentType,
    description: 'Ban chuyên môn mặc định nếu trong file không ghi rõ',
  })
  @IsOptional()
  @IsEnum(DepartmentType)
  departmentCode?: DepartmentType;
}
