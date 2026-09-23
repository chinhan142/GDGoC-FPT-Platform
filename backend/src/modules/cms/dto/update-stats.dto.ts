import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MilestoneStatItemDto {
  @ApiProperty({ description: 'Nhãn hiển thị', example: 'Hoạt Động & Sự Kiện' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ description: 'Giá trị hiển thị', example: '10+' })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết', example: 'Workshop, Hackathon, Talkshow' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Mã màu nhấn Hex', example: '#4285F4' })
  @IsString()
  @IsOptional()
  accentColor?: string;
}

export class UpdateStatsDto {
  @ApiProperty({
    type: [MilestoneStatItemDto],
    description: 'Danh sách các thẻ thống kê tác động trên Landing Page',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MilestoneStatItemDto)
  stats: MilestoneStatItemDto[];
}
