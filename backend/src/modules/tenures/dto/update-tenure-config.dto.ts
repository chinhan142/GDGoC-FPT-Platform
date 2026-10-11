import { IsBoolean, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTenureConfigDto {
  @ApiPropertyOptional({
    description: 'Khóa không cho nộp bài task',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isFrozen?: boolean;

  @ApiPropertyOptional({
    description: 'Cho phép thành viên nộp bài nghiệm thu task',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  allowTaskSubmission?: boolean;


  @ApiPropertyOptional({
    description: 'Đóng băng bảng xếp hạng Gems cuối kỳ',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  freezeLeaderboard?: boolean;

  @ApiPropertyOptional({
    description: 'Tên Chapter Lead nhiệm kỳ này',
  })
  @IsString()
  @IsOptional()
  chapterLead?: string;

  @ApiPropertyOptional({
    description: 'Tên Co-Chapter Lead nhiệm kỳ này',
  })
  @IsString()
  @IsOptional()
  coChapterLead?: string;

  @ApiPropertyOptional({
    description: 'Tên nhiệm kỳ (ví dụ: Fall 2026)',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Tên khóa/Gen (ví dụ: Gen 4.0)',
  })
  @IsString()
  @IsOptional()
  genLabel?: string;

  @ApiPropertyOptional({
    description: 'Ngày bắt đầu nhiệm kỳ',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Ngày kết thúc nhiệm kỳ',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
