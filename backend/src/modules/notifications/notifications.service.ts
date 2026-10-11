import { isLevelOne, currentMembership, canWork } from '../common/access';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { DepartmentType, Prisma, Role } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all notifications for current user with unread counter
   */
  async dailySummary(user: any) {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const count = canWork(currentMembership(user)) ? await this.prisma.task.count({ where: { assignees: { some: { userId: user.id } }, semester: { isClosed: false }, status: { in: ['TODO','IN_PROGRESS','OVERDUE','BACKLOG'] }, deadline: { lte: new Date(day+'T23:59:59.999+07:00') } } }) : 0;
    return { count, greeting: 'Chào ' + user.fullName + (count ? ', hôm nay bạn có ' + count + ' công việc cần hoàn thành (gồm cả quá hạn).' : ', chúc bạn ngày mới vui vẻ!') };
  }
  async findAllForUser(user: any, query: QueryNotificationsDto) {
    const { type, unreadOnly, page = 1, limit = 20 } = query;

    // Extract user department IDs across active tenures
    const userDepartmentIds: string[] = [];
    if (user.tenures && user.tenures.length > 0) {
      for (const t of user.tenures) {
        if (t.departmentId && !userDepartmentIds.includes(t.departmentId)) {
          userDepartmentIds.push(t.departmentId);
        }
      }
    }

    // Notifications visible to user: broadcast (null) OR target belongs to user's departments
    const baseWhere: Prisma.NotificationWhereInput = {
      OR: [
        { targetUserId: user.id } , { targetUserId: null, targetDepartmentId: null },
        { targetUserId: null, targetDepartmentId: { in: userDepartmentIds } },
      ],
    };

    if (type) {
      baseWhere.type = type;
    }

    // Count unread notifications
    const unreadCount = await this.prisma.notification.count({
      where: {
        ...baseWhere,
        reads: {
          none: {
            userId: user.id,
          },
        },
      },
    });

    const where: Prisma.NotificationWhereInput = { ...baseWhere };

    if (unreadOnly) {
      where.reads = {
        none: {
          userId: user.id,
        },
      };
    }

    const skip = (page - 1) * limit;

    const [rawNotifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reads: {
            where: {
              userId: user.id,
            },
          },
          sender: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          targetDepartment: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    const items = rawNotifications.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      priority: n.priority,
      isRead: n.reads.length > 0,
      createdAt: n.createdAt,
      link: n.link,
      sender: n.sender,
      targetDepartment: n.targetDepartment,
    }));

    return {
      unreadCount,
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create new notification (Broadcast or Department-specific)
   */
  async create(sender: any, dto: CreateNotificationDto) {
    const actor = currentMembership(sender);
    const isLead = canWork(actor) && isLevelOne(actor.role);

    let targetDepartmentId: string | null = null;

    if (dto.targetDepartmentCode && dto.targetDepartmentCode !== 'all') {
      const dept = await this.prisma.department.findUnique({
        where: { code: dto.targetDepartmentCode as DepartmentType },
      });

      if (!dept) {
        throw new NotFoundException(
          `Department with code ${dto.targetDepartmentCode} not found`,
        );
      }

      targetDepartmentId = dept.id;

      // If not LEAD, check if user is DEPARTMENT_LEAD of this department
      if (!isLead) {
        const isDeptLeadOfThisDept = sender.tenures?.some(
          (t: any) =>
            t.role === Role.DEPARTMENT_LEAD && t.departmentId === dept.id,
        );

        if (!isDeptLeadOfThisDept) {
          throw new ForbiddenException(
            'Trưởng ban chỉ có quyền phát thông báo cho ban chuyên môn của mình.',
          );
        }
      }
    } else {
      // Broadcast to entire club -> Only LEAD
      if (!isLead) {
        throw new ForbiddenException(
          'Chỉ Ban Chủ Nhiệm (LEAD) mới có quyền phát thông báo Broadcast cho toàn bộ CLB.',
        );
      }
    }

    return this.prisma.notification.create({
      data: {
        title: dto.title,
        message: dto.message,
        type: dto.type,
        priority: dto.priority,
        targetDepartmentId,
        link: dto.link,
        senderId: sender.id,
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        targetDepartment: true,
      },
    });
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(
        `Notification with ID ${notificationId} not found`,
      );
    }

    if (notification.targetUserId && notification.targetUserId !== userId) throw new ForbiddenException('Thông báo dành cho tài khoản khác.');
    if (!notification.targetUserId && notification.targetDepartmentId) {
      const membership = await this.prisma.userTenure.findFirst({ where: { userId, departmentId: notification.targetDepartmentId, tenure: { isArchived: false } } });
      if (!membership) throw new ForbiddenException('Bạn không thuộc ban nhận thông báo.');
    }
    await this.prisma.notificationRead.upsert({
      where: {
        notificationId_userId: {
          notificationId,
          userId,
        },
      },
      create: {
        notificationId,
        userId,
        readAt: new Date(),
      },
      update: {
        readAt: new Date(),
      },
    });

    return { message: 'Đã đánh dấu thông báo là đã đọc.' };
  }

  /**
   * Mark all notifications as read for current user
   */
  async markAllAsRead(user: any) {
    const userDepartmentIds: string[] = [];
    if (user.tenures && user.tenures.length > 0) {
      for (const t of user.tenures) {
        if (t.departmentId && !userDepartmentIds.includes(t.departmentId)) {
          userDepartmentIds.push(t.departmentId);
        }
      }
    }

    // Find all visible unread notifications
    const unreadNotifications = await this.prisma.notification.findMany({
      where: {
        OR: [
          { targetUserId: user.id } , { targetUserId: null, targetDepartmentId: null },
          { targetUserId: null, targetDepartmentId: { in: userDepartmentIds } },
        ],
        reads: {
          none: {
            userId: user.id,
          },
        },
      },
      select: { id: true },
    });

    if (unreadNotifications.length > 0) {
      await this.prisma.notificationRead.createMany({
        data: unreadNotifications.map((n) => ({
          notificationId: n.id,
          userId: user.id,
          readAt: new Date(),
        })),
        skipDuplicates: true,
      });
    }

    return {
      message: `Đã đánh dấu ${unreadNotifications.length} thông báo là đã đọc.`,
      readCount: unreadNotifications.length,
    };
  }

  /**
   * Delete notification (LEAD or original sender)
   */
  async remove(user: any, id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    const isLead = user.tenures?.some((t: any) => isLevelOne(t.role));

    if (!isLead && notification.senderId !== user.id) {
      throw new ForbiddenException(
        'Bạn chỉ có quyền xóa thông báo do chính mình tạo ra.',
      );
    }

    await this.prisma.notification.delete({
      where: { id },
    });

    return { message: `Thông báo ${id} đã được xóa thành công.` };
  }
}
