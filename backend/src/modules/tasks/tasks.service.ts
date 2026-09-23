import {
  BadRequestException,
  ForbiddenException,
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
import {
  GemsTransactionType,
  Prisma,
  Role,
  TaskAssigneeRole,
  TaskStatus,
} from '@prisma/client';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly discordService: DiscordService,
  ) {}

  /**
   * Helper to resolve departmentId from departmentId or departmentCode
   */
  private async resolveDepartmentId(
    departmentId?: string,
    departmentCode?: any,
  ): Promise<string> {
    if (departmentId) {
      const dept = await this.prisma.department.findUnique({
        where: { id: departmentId },
      });
      if (!dept) {
        throw new NotFoundException(`Department with ID ${departmentId} not found`);
      }
      return dept.id;
    }

    if (departmentCode) {
      const dept = await this.prisma.department.findUnique({
        where: { code: departmentCode },
      });
      if (!dept) {
        throw new NotFoundException(
          `Department with code ${departmentCode} not found`,
        );
      }
      return dept.id;
    }

    throw new BadRequestException(
      'Either departmentId or departmentCode must be provided',
    );
  }

  /**
   * Helper to grant Gems reward to task assignees in a transaction
   */
  private async grantTaskGemsReward(
    tx: Prisma.TransactionClient,
    task: { id: string; title: string; gemsReward: number; assignees: { userId: string }[] },
  ) {
    if (task.assignees.length > 0 && task.gemsReward > 0) {
      for (const assignee of task.assignees) {
        const idempotencyKey = `task_reward_${task.id}_${assignee.userId}`;

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

          this.logger.log(
            `Granted ${task.gemsReward} gems to user ${assignee.userId} for task ${task.id}`,
          );
        }
      }
    }
  }

  /**
   * Create new Task and trigger Discord Thread creation
   */
  async createTask(creatorId: string, dto: CreateTaskDto) {
    const {
      assignees,
      assigneeIds,
      deadline,
      departmentId,
      departmentCode,
      ...taskData
    } = dto;

    const resolvedDeptId = await this.resolveDepartmentId(
      departmentId,
      departmentCode,
    );

    // Chuẩn hóa assignees
    let finalAssignees: { userId: string; role: TaskAssigneeRole }[] = [];
    if (assignees && assignees.length > 0) {
      finalAssignees = assignees;
    } else if (assigneeIds && assigneeIds.length > 0) {
      finalAssignees = assigneeIds.map((userId) => ({
        userId,
        role: TaskAssigneeRole.MEMBER,
      }));
    }

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          ...taskData,
          departmentId: resolvedDeptId,
          deadline: new Date(deadline),
          creatorId,
          assignees:
            finalAssignees.length > 0
              ? {
                  createMany: {
                    data: finalAssignees.map((a) => ({
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
      departmentCode,
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
    if (departmentCode) {
      where.department = { code: departmentCode };
    }
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
      items: data,
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

    const {
      assignees,
      assigneeIds,
      deadline,
      departmentId,
      departmentCode,
      ...updateData
    } = dto;

    let resolvedDeptId: string | undefined = undefined;
    if (departmentId || departmentCode) {
      resolvedDeptId = await this.resolveDepartmentId(
        departmentId,
        departmentCode,
      );
    }

    let finalAssignees: { userId: string; role: TaskAssigneeRole }[] | undefined =
      undefined;
    if (assignees !== undefined) {
      finalAssignees = assignees;
    } else if (assigneeIds !== undefined) {
      finalAssignees = assigneeIds.map((userId) => ({
        userId,
        role: TaskAssigneeRole.MEMBER,
      }));
    }

    return this.prisma.$transaction(async (tx) => {
      if (finalAssignees !== undefined) {
        await tx.taskAssignee.deleteMany({
          where: { taskId: id },
        });

        if (finalAssignees.length > 0) {
          await tx.taskAssignee.createMany({
            data: finalAssignees.map((a) => ({
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
          departmentId: resolvedDeptId,
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
   * If status -> DONE, automatically triggers Gems reward in transaction
   */
  async updateStatus(id: string, dto: UpdateTaskStatusDto, user?: any) {
    const task = await this.findOne(id);

    // Permission check for MEMBER
    if (user && user.tenures) {
      const activeTenure = user.tenures.find(
        (t: any) => t.tenureId === task.tenureId,
      ) || user.tenures[0];

      const userRole = activeTenure?.role;
      const isAssignee = task.assignees.some((a) => a.userId === user.id);

      if (userRole === Role.MEMBER || userRole === Role.COLLABORATOR) {
        if (!isAssignee) {
          throw new ForbiddenException(
            'Bạn chỉ có quyền cập nhật trạng thái các công việc được phân công cho mình.',
          );
        }
        if (dto.status === TaskStatus.DONE) {
          throw new ForbiddenException(
            'Chỉ Ban Chủ Nhiệm hoặc Trưởng Ban mới có quyền phê duyệt hoàn thành công việc (DONE).',
          );
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: {
          status: dto.status,
          submissionUrl: dto.submissionUrl ?? task.submissionUrl,
          feedback: dto.feedback ?? task.feedback,
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
                  gemsBalance: true,
                },
              },
            },
          },
        },
      });

      // If moved to DONE, auto grant Gems
      if (dto.status === TaskStatus.DONE && task.status !== TaskStatus.DONE) {
        await this.grantTaskGemsReward(tx, {
          id: task.id,
          title: task.title,
          gemsReward: task.gemsReward,
          assignees: task.assignees.map((a) => ({ userId: a.userId })),
        });
      }

      return updated;
    });
  }

  /**
   * Manage task assignees
   */
  async assignUsers(id: string, dto: AssignTaskDto) {
    await this.findOne(id);

    let finalAssignees: { userId: string; role: TaskAssigneeRole }[] = [];
    if (dto.assignees && dto.assignees.length > 0) {
      finalAssignees = dto.assignees;
    } else if (dto.assigneeIds && dto.assigneeIds.length > 0) {
      finalAssignees = dto.assigneeIds.map((userId) => ({
        userId,
        role: TaskAssigneeRole.MEMBER,
      }));
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.taskAssignee.deleteMany({
        where: { taskId: id },
      });

      if (finalAssignees.length > 0) {
        await tx.taskAssignee.createMany({
          data: finalAssignees.map((a) => ({
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
      await this.grantTaskGemsReward(tx, {
        id: task.id,
        title: task.title,
        gemsReward: task.gemsReward,
        assignees: task.assignees.map((a) => ({ userId: a.userId })),
      });

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
