import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveTaskDto {
  @ApiPropertyOptional({
    description: 'Nhận xét / Phản hồi khi phê duyệt công việc',
    example: 'Bài làm rất tốt, đúng tiến độ!',
  })
  @IsString()
  @IsOptional()
  feedback?: string;
}

export class RejectTaskDto {
  @ApiProperty({
    description: 'Lý do yêu cầu sửa lại / từ chối',
    example: 'Cần bổ sung tài liệu hướng dẫn và unit test.',
  })
  @IsString()
  @IsNotEmpty()
  feedback: string;
}
