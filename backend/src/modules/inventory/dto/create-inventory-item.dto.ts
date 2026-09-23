import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInventoryItemDto {
  @ApiProperty({ description: 'Tên vật tư / tài sản', example: 'Micro không dây Shure' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Phân loại: Asset (Tài sản), Gift (Quà tặng), Consumable (Tiêu hao)',
    example: 'Asset',
  })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ description: 'Số lượng trong kho', example: 2 })
  @IsInt()
  @Min(0)
  @IsNotEmpty()
  quantity: number;

  @ApiProperty({
    description: 'Tên người đang nắm giữ hoặc vị trí lưu trữ',
    example: 'Lưu tại tủ đồ CLB',
  })
  @IsString()
  @IsNotEmpty()
  holderName: string;

  @ApiPropertyOptional({
    description: 'ID của User đang giữ (nếu có)',
  })
  @IsString()
  @IsOptional()
  holderUserId?: string;

  @ApiPropertyOptional({
    description: 'Ghi chú tình trạng, serial number, linh kiện kèm theo',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
