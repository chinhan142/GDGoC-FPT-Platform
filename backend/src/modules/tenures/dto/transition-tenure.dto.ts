import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransitionTenureDto {
  @ApiProperty({
    description: 'Tên nhiệm kỳ mới',
    example: 'Spring 2027',
  })
  @IsString()
  @IsNotEmpty()
  newTenureName: string;

  @ApiProperty({
    description: 'Tên khóa / Thế hệ mới',
    example: 'Gen 4.5',
  })
  @IsString()
  @IsNotEmpty()
  newGenLabel: string;

  @ApiProperty({
    description: 'Ngày bắt đầu nhiệm kỳ mới (ISO 8601)',
    example: '2027-02-01T00:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    description: 'Ngày kết thúc nhiệm kỳ mới (ISO 8601)',
    example: '2027-06-30T23:59:59.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiPropertyOptional({
    description: 'Tự động sao chép thành viên Core Team (LEAD, DEPARTMENT_LEAD) sang nhiệm kỳ mới',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  carryOverCoreTeam?: boolean = true;

  @ApiPropertyOptional({
    description: 'Phát thông báo Broadcast toàn CLB về việc chuyển giao nhiệm kỳ',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  notifyAllMembers?: boolean = true;

  @ApiPropertyOptional({
    description: 'Tên Chapter Lead nhiệm kỳ mới',
  })
  @IsString()
  @IsOptional()
  chapterLead?: string;
}
