import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class ToggleCheckinDto {
  @ApiProperty({
    example: true,
    description: 'Trạng thái điểm danh (true: Đã có mặt, false: Chưa điểm danh)',
  })
  @IsBoolean()
  @IsNotEmpty()
  checkedIn: boolean;

  @ApiPropertyOptional({
    example: 'https://gdgoc-fptu.dev/evidence/checkin_01.jpg',
    description: 'Link ảnh minh chứng có mặt tại sự kiện',
  })
  @IsOptional()
  @IsUrl()
  evidenceImageUrl?: string;

  @ApiPropertyOptional({
    example: 'Xác nhận có mặt tại bàn check-in 2',
    description: 'Ghi chú của người phụ trách điểm danh',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
