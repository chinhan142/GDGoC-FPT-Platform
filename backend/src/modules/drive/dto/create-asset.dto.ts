import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccessLevel, DepartmentType, DriveCategory } from '@prisma/client';

export class CreateAssetDto {
  @ApiProperty({ description: 'Tên tài nguyên / tệp Drive', example: 'Brand Kit GDGoC 2026' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết tài nguyên' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: DriveCategory,
    description: 'Danh mục tài nguyên (BRAND_KIT, TECH_LIBRARY, MEDIA_VAULT, PR_COMMS, FINANCE, HANDOVER_VAULT)',
    example: DriveCategory.BRAND_KIT,
  })
  @IsEnum(DriveCategory)
  @IsNotEmpty()
  category: DriveCategory;

  @ApiProperty({
    description: 'Đường dẫn Google Drive URL',
    example: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz',
  })
  @IsString()
  @IsNotEmpty()
  driveUrl: string;

  @ApiProperty({
    description: 'ID của File hoặc Folder trên Google Drive',
    example: '1AbCdEfGhIjKlMnOpQrStUvWxYz',
  })
  @IsString()
  @IsNotEmpty()
  driveFileId: string;

  @ApiPropertyOptional({
    enum: AccessLevel,
    description: 'Cấp độ phân quyền truy cập',
    default: AccessLevel.INTERNAL_MEMBER,
  })
  @IsEnum(AccessLevel)
  @IsOptional()
  accessLevel?: AccessLevel = AccessLevel.INTERNAL_MEMBER;

  @ApiPropertyOptional({
    enum: DepartmentType,
    description: 'Mã Ban chuyên môn sở hữu tài nguyên (nếu có)',
  })
  @IsEnum(DepartmentType)
  @IsOptional()
  departmentCode?: DepartmentType;

  @ApiPropertyOptional({ description: 'ID Ban chuyên môn sở hữu' })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'ID Niên khóa (Tenure UUID)' })
  @IsString()
  @IsOptional()
  tenureId?: string;

  @ApiPropertyOptional({ description: 'ID Sự kiện liên quan (nếu có)' })
  @IsString()
  @IsOptional()
  eventId?: string;
}
