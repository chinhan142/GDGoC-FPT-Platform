import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { SubmitTaskDto } from './dto/submit-task.dto';
import { ApproveTaskDto } from './dto/approve-task.dto';
import { RejectTaskDto } from './dto/reject-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';

@ApiTags('Task Management (Kanban)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @Roles(Role.LEAD, Role.DEPARTMENT_LEAD)
  @ApiOperation({
    summary: 'Tạo công việc mới (Tự động tạo Thread trên Discord)',
  })
  @ApiResponse({ status: 201, description: 'Tạo Task thành công.' })
  createTask(@GetUser('id') creatorId: string, @Body() dto: CreateTaskDto) {
    return this.tasksService.createTask(creatorId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách công việc (Bộ lọc, Tìm kiếm, Phân trang)',
  })
  findAll(@Query() query: QueryTaskDto) {
    return this.tasksService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết công việc theo ID' })
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.LEAD, Role.DEPARTMENT_LEAD)
  @ApiOperation({ summary: 'Cập nhật thông tin công việc (PUT)' })
  updatePut(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  @Patch(':id')
  @Roles(Role.LEAD, Role.DEPARTMENT_LEAD)
  @ApiOperation({ summary: 'Cập nhật thông tin công việc (PATCH)' })
  updatePatch(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary:
      'Cập nhật trạng thái Kanban (BACKLOG, TODO, IN_PROGRESS, IN_REVIEW, DONE, OVERDUE)',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTaskStatusDto,
    @GetUser() user: any,
  ) {
    return this.tasksService.updateStatus(id, dto, user);
  }

  @Post(':id/assignees')
  @Roles(Role.LEAD, Role.DEPARTMENT_LEAD)
  @ApiOperation({
    summary:
      'Quản lý/Gán danh sách thành viên thực hiện Task (Primary & Member)',
  })
  assignUsers(@Param('id') id: string, @Body() dto: AssignTaskDto) {
    return this.tasksService.assignUsers(id, dto);
  }

  @Post(':id/submit')
  @ApiOperation({
    summary: 'Nộp bài hoàn thành công việc (Link Google Drive / GitHub)',
  })
  submitTask(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @Body() dto: SubmitTaskDto,
  ) {
    return this.tasksService.submitTask(id, userId, dto);
  }

  @Post(':id/approve')
  @Roles(Role.LEAD, Role.DEPARTMENT_LEAD)
  @ApiOperation({
    summary: 'Phê duyệt hoàn thành công việc (Cộng Gems thưởng tự động)',
  })
  approveTask(
    @Param('id') id: string,
    @GetUser('id') reviewerId: string,
    @Body() dto: ApproveTaskDto,
  ) {
    return this.tasksService.approveTask(id, reviewerId, dto);
  }

  @Post(':id/reject')
  @Roles(Role.LEAD, Role.DEPARTMENT_LEAD)
  @ApiOperation({ summary: 'Yêu cầu sửa lại / Từ chối bài nộp' })
  rejectTask(
    @Param('id') id: string,
    @GetUser('id') reviewerId: string,
    @Body() dto: RejectTaskDto,
  ) {
    return this.tasksService.rejectTask(id, reviewerId, dto);
  }

  @Delete(':id')
  @Roles(Role.LEAD)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa công việc (Chỉ BCN)' })
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }
}
