import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DiscordService } from '../discord/discord.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { SubmitTaskDto } from './dto/submit-task.dto';
import { ApproveTaskDto } from './dto/approve-task.dto';
import { RejectTaskDto } from './dto/reject-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { GemsTransactionType, Prisma, TaskStatus } from '@prisma/client';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly discordService: DiscordService,
  ) {}

  /**
   * Create new Task and trigger Discord Thread creation
   */
  async createTask(creatorId: string, dto: CreateTaskDto) {
    const { assignees, deadline, ...taskData } = dto;

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          ...taskData,
          deadline: new Date(deadline),
          creatorId,
          assignees:
            assignees && assignees.length > 0
              ? {
                  createMany: {
                    data: assignees.map((a) => ({
                      userId: a.userId,
                      role: a.role,
                    })),
                  },
                }
              : undefined,
        },
        include: {
          department: true,
          creator: {
            select: { id: true, fullName: true, email: true, discordId: true },
          },
          event: true,
          assignees: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  discordId: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      return created;
    });

    // Hero Feature: Auto create Discord Thread
    try {
      const threadId = await this.discordService.createTaskThread(task);
      if (threadId) {
        await this.prisma.task.update({
          where: { id: task.id },
          data: { discordThreadId: threadId },
        });
        task.discordThreadId = threadId;
      }
    } catch (error) {
      this.logger.error('Failed to trigger Discord thread creation:', error);
    }

    return task;
  }

  /**
   * Get list of tasks with filters, search & pagination
   * Automatically updates past-deadline tasks to OVERDUE
   */
  async findAll(query: QueryTaskDto) {
    const {
      status,
      priority,
      departmentId,
      tenureId,
      assigneeId,
      search,
      page = 1,
      limit = 20,
    } = query;

    // Auto mark overdue tasks
    const now = new Date();
    await this.prisma.task.updateMany({
      where: {
        deadline: { lt: now },
        status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
      },
      data: { status: TaskStatus.OVERDUE },
    });

    const where: Prisma.TaskWhereInput = {};

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (departmentId) where.departmentId = departmentId;
    if (tenureId) where.tenureId = tenureId;
    if (assigneeId) {
      where.assignees = {
        some: { userId: assigneeId },
      };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          department: true,
          creator: {
            select: { id: true, fullName: true, email: true, avatarUrl: true },
          },
          event: {
            select: { id: true, title: true },
          },
          assignees: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  discordId: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get Task detail by ID
   */
  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        department: true,
        tenure: true,
        creator: {
          select: { id: true, fullName: true, email: true, avatarUrl: true },
        },
        event: true,
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                discordId: true,
                avatarUrl: true,
                mssv: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }

  /**
   * Update task details & assignees
   */
  async update(id: string, dto: UpdateTaskDto) {
    await this.findOne(id);

    const { assignees, deadline, ...updateData } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (assignees !== undefined) {
        await tx.taskAssignee.deleteMany({
          where: { taskId: id },
        });

        if (assignees.length > 0) {
          await tx.taskAssignee.createMany({
            data: assignees.map((a) => ({
              taskId: id,
              userId: a.userId,
              role: a.role,
            })),
          });
        }
      }

      return tx.task.update({
        where: { id },
        data: {
          ...updateData,
          deadline: deadline ? new Date(deadline) : undefined,
        },
        include: {
          department: true,
          assignees: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });
    });
  }

  /**
   * Update Kanban status
   */
  async updateStatus(id: string, dto: UpdateTaskStatusDto) {
    await this.findOne(id);

    return this.prisma.task.update({
      where: { id },
      data: { status: dto.status },
      include: {
        department: true,
        assignees: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
      },
    });
  }

  /**
   * Manage task assignees
   */
  async assignUsers(id: string, dto: AssignTaskDto) {
    await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      await tx.taskAssignee.deleteMany({
        where: { taskId: id },
      });

      if (dto.assignees.length > 0) {
        await tx.taskAssignee.createMany({
          data: dto.assignees.map((a) => ({
            taskId: id,
            userId: a.userId,
            role: a.role,
          })),
        });
      }

      return tx.task.findUnique({
        where: { id },
        include: {
          assignees: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });
    });
  }

  /**
   * Submit task solution URL (Google Drive / GitHub link)
   */
  async submitTask(id: string, userId: string, dto: SubmitTaskDto) {
    const task = await this.findOne(id);

    if (task.status === TaskStatus.DONE) {
      throw new BadRequestException('Task is already completed and approved.');
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        submissionUrl: dto.submissionUrl,
        status: TaskStatus.IN_REVIEW,
      },
      include: {
        assignees: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
      },
    });
  }

  /**
   * Approve task: Move to DONE state & grant Gems reward to assignees via GemsTransaction
   */
  async approveTask(id: string, reviewerId: string, dto: ApproveTaskDto) {
    const task = await this.findOne(id);

    if (task.status === TaskStatus.DONE) {
      throw new BadRequestException('Task has already been approved.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id },
        data: {
          status: TaskStatus.DONE,
          feedback: dto.feedback || task.feedback,
        },
        include: {
          assignees: true,
        },
      });

      // Award Gems to each assignee
      if (task.assignees.length > 0 && task.gemsReward > 0) {
        for (const assignee of task.assignees) {
          const idempotencyKey = `task_reward_${task.id}_${assignee.userId}`;

          // Check if transaction already executed
          const existingTx = await tx.gemsTransaction.findUnique({
            where: { idempotencyKey },
          });

          if (!existingTx) {
            await tx.gemsTransaction.create({
              data: {
                userId: assignee.userId,
                amount: task.gemsReward,
                type: GemsTransactionType.TASK_REWARD,
                referenceId: task.id,
                reason: `Thưởng hoàn thành công việc: ${task.title}`,
                idempotencyKey,
              },
            });

            await tx.user.update({
              where: { id: assignee.userId },
              data: {
                gemsBalance: {
                  increment: task.gemsReward,
                },
              },
            });
          }
        }
      }

      return tx.task.findUnique({
        where: { id },
        include: {
          department: true,
          assignees: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  gemsBalance: true,
                  email: true,
                },
              },
            },
          },
        },
      });
    });
  }

  /**
   * Reject task submission: Request revision with feedback
   */
  async rejectTask(id: string, reviewerId: string, dto: RejectTaskDto) {
    const task = await this.findOne(id);

    if (task.status === TaskStatus.DONE) {
      throw new BadRequestException('Cannot reject an already completed task.');
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.IN_PROGRESS,
        feedback: dto.feedback,
      },
      include: {
        department: true,
        assignees: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
      },
    });
  }

  /**
   * Remove a task
   */
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.task.delete({
      where: { id },
    });
    return { message: `Task ${id} has been deleted successfully.` };
  }
}
