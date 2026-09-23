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
        { targetDepartmentId: null },
        { targetDepartmentId: { in: userDepartmentIds } },
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
    const isLead = sender.tenures?.some((t: any) => t.role === Role.LEAD);

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
          { targetDepartmentId: null },
          { targetDepartmentId: { in: userDepartmentIds } },
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

    const isLead = user.tenures?.some((t: any) => t.role === Role.LEAD);

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
