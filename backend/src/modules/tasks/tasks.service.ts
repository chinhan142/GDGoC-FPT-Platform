import { activeSemester, canWork, currentMembership, isLevelOne } from '../common/access';
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

  private async notifyAssignments(tx: Prisma.TransactionClient, task: { id: string; title: string }, senderId: string, assigned: string[]) {
    for (const userId of assigned) await tx.notification.create({ data: { title: 'Bạn có công việc mới', message: task.title, type: 'TASK', targetUserId: userId, senderId, link: '/app/tasks' } });
  }
  private async validateAssignees(actorId: string, tenureId: string, departmentId: string, ids: string[]) {
    const actor = await this.prisma.userTenure.findUnique({ where: { userId_tenureId: { userId: actorId, tenureId } } });
    const targets = await this.prisma.userTenure.findMany({ where: { tenureId, userId: { in: ids } } });
    if (!ids.length || new Set(ids).size !== ids.length || targets.length !== ids.length || !canWork(actor)
      || targets.some(t => !canWork(t) || t.departmentId !== departmentId || (isLevelOne(actor!.role) ? t.role !== Role.DEPARTMENT_LEAD : actor!.role !== Role.DEPARTMENT_LEAD || (t.role !== Role.MEMBER && t.userId !== actorId) || actor!.departmentId !== departmentId))) {
      throw new BadRequestException('Chỉ giao việc Lv1 → Trưởng ban, hoặc Trưởng ban → thành viên đang hoạt động trong ban mình.');
    }
  }
  private async assertManager(userId: string, tenureId: string, departmentId: string) {
    const membership = await this.prisma.userTenure.findUnique({
      where: { userId_tenureId: { userId, tenureId } },
      include: { tenure: true },
    });
    if (!membership || membership.tenure.isFrozen || membership.tenure.isArchived
      || !['ACTIVE', 'PROBATION'].includes(membership.status)
      || !(isLevelOne(membership.role) || (membership.role === Role.DEPARTMENT_LEAD && membership.departmentId === departmentId))) {
      throw new ForbiddenException('Bạn không có quyền quản lý công việc trong ban/nhiệm kỳ này.');
    }
  }

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
      const codeStr = String(departmentCode).toUpperCase().replace('-', '_');
      const normalizedCode =
        codeStr.startsWith('TECH_') ||
        codeStr === 'MEDIA' ||
        codeStr === 'HR_EVENT' ||
        codeStr === 'EXECUTIVE'
          ? codeStr
          : codeStr === 'AI'
            ? 'TECH_AI'
            : codeStr === 'CLOUD'
              ? 'TECH_CLOUD'
              : codeStr === 'WEB'
                ? 'TECH_WEB'
                : codeStr === 'RESEARCH'
                  ? 'TECH_RESEARCH'
                  : codeStr;

      const dept = await this.prisma.department.findFirst({
        where: {
          OR: [
            { code: departmentCode },
            { code: normalizedCode as any },
          ],
        },
      });
      if (dept) {
        return dept.id;
      }
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
    task: { semesterId: string; id: string; title: string; gemsReward: number; assignees: { userId: string }[] },
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
              semesterId: task.semesterId,
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
      tenureId,
      ...taskData
    } = dto;

    let finalTenureId = tenureId;
    if (!finalTenureId) {
      const activeTenure = await this.prisma.tenure.findFirst({
        where: { isArchived: false, isFrozen: false },
        orderBy: { startDate: 'desc' },
      });
      finalTenureId = activeTenure?.id;
    }

    if (!finalTenureId) {
      throw new BadRequestException('No active tenure found to create task.');
    }

    const resolvedDeptId = await this.resolveDepartmentId(
      departmentId,
      departmentCode,
    );
    await this.assertManager(creatorId, finalTenureId, resolvedDeptId);
    if (taskData.status === TaskStatus.DONE || taskData.status === TaskStatus.IN_REVIEW) {
      throw new BadRequestException('Công việc mới phải đi qua luồng nộp và duyệt.');
    }

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

    const semester = await activeSemester(this.prisma, finalTenureId);
    if (taskData.eventId && !await this.prisma.event.findFirst({ where: { id: taskData.eventId, semesterId: semester.id } })) throw new BadRequestException('Sự kiện phải thuộc kỳ hiện tại.');
    await this.validateAssignees(creatorId, finalTenureId, resolvedDeptId, finalAssignees.map(a => a.userId));

    const actorMembership = await this.prisma.userTenure.findUnique({ where: { userId_tenureId: { userId: creatorId, tenureId: finalTenureId } } });
    finalAssignees = finalAssignees.map(a => ({ ...a, role: isLevelOne(actorMembership!.role) ? TaskAssigneeRole.PRIMARY : TaskAssigneeRole.MEMBER }));
    // Authenticated creator must exist; never impersonate a fallback account.
    const validCreatorId = creatorId;
    const existingCreator = await this.prisma.user.findUnique({
      where: { id: validCreatorId },
    });
    if (!existingCreator) {
      throw new ForbiddenException('Không tìm thấy người tạo công việc.');
    }

    // Validate that assignees actually exist in User table
    if (finalAssignees.length > 0) {
      const userIds = finalAssignees.map((a) => a.userId);
      const existingUsers = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true },
      });
      const validSet = new Set(existingUsers.map((u) => u.id));
      if (finalAssignees.some((a) => !validSet.has(a.userId))) {
        throw new BadRequestException('Người được giao công việc không tồn tại.');
      }
    }

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          ...taskData,
          tenureId: finalTenureId,
          semesterId: semester.id,
          departmentId: resolvedDeptId,
          deadline: new Date(deadline),
          creatorId: validCreatorId,
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

      await this.notifyAssignments(tx, created, creatorId, finalAssignees.map(a=>a.userId));
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
  async findAll(query: QueryTaskDto, user?: any) {
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

    const where: Prisma.TaskWhereInput = {};
    if (user) {
      const membership = currentMembership(user);
      if (!canWork(membership) || !isLevelOne(membership?.role)) {
        const own = { assignees: { some: { userId: user.id } } };
        where.AND = canWork(membership) && membership.role === Role.DEPARTMENT_LEAD ? [{ OR: [own, { departmentId: membership.departmentId }] }] : [own];
      }
    }

    if (query.semesterId && query.semesterId !== 'all') where.semesterId = query.semesterId;
    if (query.doneDays) { const conditions = Array.isArray(where.AND) ? where.AND : []; where.AND = [...conditions, { OR: [{ status: { not: TaskStatus.DONE } }, { completedAt: { gte: new Date(Date.now() - query.doneDays * 86400000) } }] }]; }
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
  async findOne(id: string, user?: any) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        department: true,
        tenure: true,
        semester: true,
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

    if (user) {
      const m = currentMembership(user);
      const own = task.assignees.some(a => a.userId === user.id);
      if (!own && !(canWork(m) && (isLevelOne(m.role) || (m.role === Role.DEPARTMENT_LEAD && m.departmentId === task.departmentId)))) throw new ForbiddenException('Bạn không có quyền xem công việc này.');
    }
    return task;
  }

  /**
   * Update task details & assignees
   */
  async update(id: string, dto: UpdateTaskDto, userId: string) {
    const task = await this.findOne(id);
    if (task.semester.isClosed) throw new BadRequestException('Kỳ đã chốt; công việc chỉ đọc.');
    await this.assertManager(userId, task.tenureId, task.departmentId);
    if (dto.status !== undefined || task.status === TaskStatus.DONE) {
      throw new BadRequestException('Dùng luồng Kanban/nộp/duyệt để đổi trạng thái; công việc đã duyệt không thể sửa.');
    }

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
    await this.assertManager(userId, dto.tenureId || task.tenureId, resolvedDeptId || task.departmentId);

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

    if (dto.tenureId && dto.tenureId !== task.tenureId) throw new BadRequestException('Không chuyển công việc sang nhiệm kỳ khác.');
    await this.validateAssignees(userId, task.tenureId, resolvedDeptId || task.departmentId, (finalAssignees || task.assignees).map(a => a.userId));
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

      if (finalAssignees) await this.notifyAssignments(tx, task, userId, finalAssignees.filter(a=>!task.assignees.some(old=>old.userId===a.userId)).map(a=>a.userId));
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
    if (task.semester.isClosed) throw new BadRequestException('Kỳ đã chốt; công việc chỉ đọc.');
    if (!user || task.tenure.isFrozen || task.tenure.isArchived || task.status === TaskStatus.DONE) {
      throw new ForbiddenException('Công việc đã duyệt hoặc nhiệm kỳ đã khóa.');
    }
    const membership = user.tenures?.find((t: any) => t.tenureId === task.tenureId && ['ACTIVE', 'PROBATION'].includes(t.status));
    if (!membership) throw new ForbiddenException('Bạn không có quyền cập nhật công việc.');
    if (isLevelOne(membership.role) || membership.role === Role.DEPARTMENT_LEAD) {
      await this.assertManager(user.id, task.tenureId, task.departmentId);
    }

    if ([TaskStatus.DONE, TaskStatus.IN_REVIEW].includes(dto.status as any)) throw new BadRequestException('Dùng chức năng nộp minh chứng và duyệt để hoàn thành công việc.');
    // Permission check for MEMBER
    if (user && user.tenures) {
      const activeTenure = user.tenures.find(
        (t: any) => t.tenureId === task.tenureId,
      );

      const userRole = activeTenure?.role;
      const isAssignee = task.assignees.some((a) => a.userId === user.id);

      if (userRole === Role.MEMBER) {
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
          semesterId: task.semesterId,
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
  async assignUsers(id: string, dto: AssignTaskDto, userId: string) {
    const task = await this.findOne(id);
    if (task.semester.isClosed) throw new BadRequestException('Kỳ đã chốt; công việc chỉ đọc.');
    await this.assertManager(userId, task.tenureId, task.departmentId);
    if (task.status === TaskStatus.DONE) throw new BadRequestException('Công việc đã duyệt không thể đổi người thực hiện.');

    let finalAssignees: { userId: string; role: TaskAssigneeRole }[] = [];
    if (dto.assignees && dto.assignees.length > 0) {
      finalAssignees = dto.assignees;
    } else if (dto.assigneeIds && dto.assigneeIds.length > 0) {
      finalAssignees = dto.assigneeIds.map((userId) => ({
        userId,
        role: TaskAssigneeRole.MEMBER,
      }));
    }

    await this.validateAssignees(userId, task.tenureId, task.departmentId, finalAssignees.map(a => a.userId));
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

      await this.notifyAssignments(tx, task, userId, finalAssignees.filter(a=>!task.assignees.some(old=>old.userId===a.userId)).map(a=>a.userId));
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
    if (task.semester.isClosed) throw new BadRequestException('Kỳ đã chốt; công việc chỉ đọc.');

    if (!task.assignees.some((assignee) => assignee.userId === userId)) {
      throw new ForbiddenException('Bạn chỉ được nộp minh chứng cho công việc được giao.');
    }
    if (task.tenure.isFrozen || task.tenure.isArchived) {
      throw new BadRequestException('Nhiệm kỳ đã khóa.');
    }
    const settings = await this.prisma.landingConfig.findUnique({
      where: { key: `generation_settings_${task.tenureId}` },
    });
    if ((settings?.data as Record<string, any> | undefined)?.allowTaskSubmission === false) {
      throw new BadRequestException('Nhiệm kỳ đang tắt chức năng nộp minh chứng.');
    }

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
    if (task.semester.isClosed) throw new BadRequestException('Kỳ đã chốt; công việc chỉ đọc.');
    await this.assertManager(reviewerId, task.tenureId, task.departmentId);
    if (task.assignees.some(a => a.userId === reviewerId)) throw new ForbiddenException('Không thể tự duyệt công việc được giao cho mình.');
    if (task.status !== TaskStatus.IN_REVIEW || !task.submissionUrl) throw new BadRequestException('Chỉ duyệt công việc đã nộp minh chứng.');

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(726110)`;
      const period = await tx.semester.findUnique({ where: { id: task.semesterId } });
      if (!period || period.isClosed) throw new BadRequestException('Kỳ đã chốt.');
      const claimed = await tx.task.updateMany({
        where: { id, status: TaskStatus.IN_REVIEW },
        data: {
          status: TaskStatus.DONE,
          completedAt: new Date(),
          feedback: dto.feedback || task.feedback,
        },
      });
      if (!claimed.count) throw new BadRequestException('Công việc đã được xử lý bởi người khác.');

      // Award Gems to each assignee
      await this.grantTaskGemsReward(tx, {
        semesterId: task.semesterId,
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
    if (task.semester.isClosed) throw new BadRequestException('Kỳ đã chốt; công việc chỉ đọc.');
    await this.assertManager(reviewerId, task.tenureId, task.departmentId);
    if (task.assignees.some(a => a.userId === reviewerId)) throw new ForbiddenException('Không thể tự duyệt công việc được giao cho mình.');

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
  async remove(id: string, userId: string) {
    const task = await this.findOne(id);
    if (task.semester.isClosed) throw new BadRequestException('Kỳ đã chốt; công việc chỉ đọc.');
    await this.assertManager(userId, task.tenureId, task.departmentId);
    if (task.status === TaskStatus.DONE) throw new BadRequestException('Giữ công việc đã thưởng Gems để đối soát lịch sử.');
    return this.prisma.$transaction(async (tx) => {
      await tx.taskAssignee.deleteMany({
        where: { taskId: id },
      });
      await tx.task.delete({
        where: { id },
      });
      return { message: `Task ${id} has been deleted successfully.` };
    });
  }
}
