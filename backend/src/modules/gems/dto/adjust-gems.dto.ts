import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdjustGemsDto {
  @ApiProperty({ description: 'ID của User được điều chỉnh Gems' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description:
      'Số lượng Gems điều chỉnh (Dương: Thưởng thêm Gems, Âm: Khấu trừ/Phạt Gems)',
    example: 100,
  })
  @IsInt()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    description: 'Lý do khen thưởng hoặc phạt',
    example: 'Khen thưởng tổ chức Workshop Gemini 2.0 xuất sắc',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
