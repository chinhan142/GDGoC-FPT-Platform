import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { TaskAssigneeInput } from './create-task.dto';

export class AssignTaskDto {
  @ApiProperty({
    type: [TaskAssigneeInput],
    description: 'Danh sách người phân công mới',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskAssigneeInput)
  assignees: TaskAssigneeInput[];
}
