import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectTaskDto {
  @ApiProperty({
    description: 'Lý do yêu cầu sửa lại / từ chối',
    example: 'Cần bổ sung tài liệu hướng dẫn và unit test.',
  })
  @IsString()
  @IsNotEmpty()
  feedback: string;
}
