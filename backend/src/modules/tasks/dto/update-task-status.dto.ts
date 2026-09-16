import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
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
}
