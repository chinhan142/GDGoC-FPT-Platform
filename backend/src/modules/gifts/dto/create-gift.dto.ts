import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGiftDto {
  @ApiProperty({ description: 'Tên món quà tặng / Merchandise' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết quà tặng' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Link ảnh quà tặng' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ description: 'Giá đổi bằng Gems', example: 100 })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  gemsPrice: number;

  @ApiPropertyOptional({ description: 'Số lượng tồn kho', default: 10 })
  @IsInt()
  @Min(0)
  @IsOptional()
  stock?: number = 10;

  @ApiPropertyOptional({
    description: 'Trạng thái sẵn sàng cho phép đổi quà',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
