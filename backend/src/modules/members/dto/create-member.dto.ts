import { DepartmentType, Role } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateMemberDto {
  @ApiProperty({
    example: 'SE180123',
    description: 'Mã số sinh viên ĐH FPT',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @Matches(/^(SE|SS|IA|IB|GD|CS|IT|HE)\d{6}$/, {
    message: 'Mã số sinh viên không hợp lệ (VD: SE180123)',
  })
  mssv: string;

  @ApiProperty({
    example: 'Trần Nguyên Bảo',
    description: 'Họ và tên thành viên',
  })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({
    example: 'baotnse180123@fpt.edu.vn',
    description: 'Email trường FPT cấp hoặc email cá nhân',
  })
  @IsString()
  @IsNotEmpty()
  @IsEmail({}, { message: 'Định dạng email không hợp lệ' })
  email: string;

  @ApiPropertyOptional({
    example: '0903456789',
    description: 'Số điện thoại liên hệ',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({
    enum: DepartmentType,
    example: 'TECH_AI',
    description: 'Ban chuyên môn phân bổ',
  })
  @IsNotEmpty()
  @IsEnum(DepartmentType)
  departmentCode: DepartmentType;

  @ApiPropertyOptional({
    enum: Role,
    default: Role.MEMBER,
    description: 'Vai trò trong nhiệm kỳ',
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role = Role.MEMBER;

  @ApiPropertyOptional({
    example: 'AI Lead',
    description: 'Chức danh hiển thị',
  })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiProperty({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'ID nhiệm kỳ tham gia',
  })
  @IsNotEmpty()
  @IsString()
  tenureId: string;

  @ApiPropertyOptional({
    example: '2026-09-15T00:00:00.000Z',
    description: 'Thời điểm gia nhập',
  })
  @IsOptional()
  @IsDateString()
  joinedAt?: string;
}
