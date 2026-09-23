import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DepartmentType, TaskPriority, TaskStatus, TaskAssigneeRole } from '@prisma/client';

export class TaskAssigneeInput {
  @ApiProperty({ description: 'ID của User được gán task' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    enum: TaskAssigneeRole,
    description: 'Vai trò: PRIMARY (chủ trì) hoặc MEMBER (hỗ trợ)',
    default: TaskAssigneeRole.MEMBER,
  })
  @IsEnum(TaskAssigneeRole)
  @IsNotEmpty()
  role: TaskAssigneeRole;
}

export class CreateTaskDto {
  @ApiProperty({ description: 'Tiêu đề công việc' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết công việc' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.TODO })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiProperty({ description: 'Thời hạn hoàn thành (ISO 8601 string)' })
  @IsDateString()
  @IsNotEmpty()
  deadline: string;

  @ApiPropertyOptional({
    description: 'Số lượng Gems thưởng khi hoàn thành',
    default: 20,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  gemsReward?: number;

  @ApiProperty({ description: 'ID Niên khóa (Tenure)' })
  @IsString()
  @IsNotEmpty()
  tenureId: string;

  @ApiPropertyOptional({
    enum: DepartmentType,
    description: 'Mã Ban chuyên môn (ví dụ: TECH_AI, TECH_WEB)',
  })
  @IsEnum(DepartmentType)
  @IsOptional()
  departmentCode?: DepartmentType;

  @ApiPropertyOptional({ description: 'ID Ban chuyên môn (Department UUID)' })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'ID Sự kiện liên quan (nếu có)' })
  @IsString()
  @IsOptional()
  eventId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Danh sách User ID được gán task (dạng đơn giản)',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  assigneeIds?: string[];

  @ApiPropertyOptional({
    type: [TaskAssigneeInput],
    description: 'Danh sách người được gán công việc (kèm vai trò PRIMARY / MEMBER)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskAssigneeInput)
  @IsOptional()
  assignees?: TaskAssigneeInput[];
}
