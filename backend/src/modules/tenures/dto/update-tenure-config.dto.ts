import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTenureConfigDto {
  @ApiPropertyOptional({
    description: 'Khóa không cho nộp bài task / check-in sự kiện mới',
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
    description: 'Cho phép sinh viên / khách đăng ký tham dự sự kiện (RSVP)',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  allowRsvp?: boolean;

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
}
