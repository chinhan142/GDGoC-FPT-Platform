import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskAssigneeInput } from './create-task.dto';

export class AssignTaskDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Danh sách User ID được phân công',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  assigneeIds?: string[];

  @ApiPropertyOptional({
    type: [TaskAssigneeInput],
    description: 'Danh sách người phân công mới kèm vai trò',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskAssigneeInput)
  @IsOptional()
  assignees?: TaskAssigneeInput[];
}
