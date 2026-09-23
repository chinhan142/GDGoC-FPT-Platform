import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';

export class UpdateTaskStatusDto {
  @ApiProperty({
    enum: TaskStatus,
    description:
      'Trạng thái Kanban mới (BACKLOG, TODO, IN_PROGRESS, IN_REVIEW, DONE, OVERDUE)',
  })
  @IsEnum(TaskStatus)
  @IsNotEmpty()
  status: TaskStatus;

  @ApiPropertyOptional({
    description: 'Link nộp bài (Google Drive, GitHub PR, Figma, v.v.)',
  })
  @IsString()
  @IsOptional()
  submissionUrl?: string;

  @ApiPropertyOptional({
    description: 'Nhận xét / Feedback của Lead khi duyệt hoặc yêu cầu chỉnh sửa',
  })
  @IsString()
  @IsOptional()
  feedback?: string;
}
