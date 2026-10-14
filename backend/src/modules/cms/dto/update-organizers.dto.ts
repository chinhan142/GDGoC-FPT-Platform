import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LandingOrganizerItemDto {
  @ApiProperty({ description: 'ID thành viên', example: 'user-uuid' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Họ và tên', example: 'Trần Võ Minh Hùng' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Chức vụ hiển thị', example: 'Chapter Lead' })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({ description: 'Nhóm ban / Domain', example: 'Leads' })
  @IsString()
  @IsNotEmpty()
  domain: string;

  @ApiPropertyOptional({ description: 'Ngành học', example: 'Kỹ thuật phần mềm' })
  @IsString()
  @IsOptional()
  major?: string;

  @ApiPropertyOptional({ description: 'Khóa đại học', example: 'K18' })
  @IsString()
  @IsOptional()
  cohort?: string;

  @ApiPropertyOptional({ description: 'Tiểu sử ngắn' })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiPropertyOptional({ description: 'Ảnh đại diện (URL hoặc base64)' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Link GitHub' })
  @IsString()
  @IsOptional()
  githubUrl?: string;

  @ApiPropertyOptional({ description: 'Link LinkedIn' })
  @IsString()
  @IsOptional()
  linkedinUrl?: string;
}

export class UpdateOrganizersDto {
  @ApiProperty({
    type: [LandingOrganizerItemDto],
    description: 'Danh sách các thành viên Core Team hiển thị ngoài Landing Page',
  })
  @IsArray()
  organizers: LandingOrganizerItemDto[];
}
