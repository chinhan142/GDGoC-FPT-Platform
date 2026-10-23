import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { DispatchMeetingDto } from './dto/dispatch-meeting.dto';
import { MemberStatus, NotificationPriority, NotificationType, Role } from '@prisma/client';
import { canWork, currentMembership, isLevelOne } from '../common/access';

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Dispatch meeting: Generates in-app notifications and sends Google Calendar invitations via email.
   */
  async dispatchMeeting(sender: any, dto: DispatchMeetingDto) {
    const actor = currentMembership(sender);
    const isLead = canWork(actor) && isLevelOne(actor.role);
    const isDeptLead = sender.tenures?.some((t: any) => t.role === Role.DEPARTMENT_LEAD);

    if (!isLead && !isDeptLead) {
      throw new ForbiddenException('Chỉ Ban Chủ Nhiệm hoặc Trưởng Ban mới có quyền thiết lập và gửi lịch họp.');
    }

    if (dto.targetType === 'ALL' && !isLead) {
      throw new ForbiddenException('Chỉ Ban Chủ Nhiệm (LEAD) mới có quyền phát lịch họp cho Toàn bộ CLB.');
    }

    const recipientMap = new Map<string, { id: string; fullName: string; email: string; avatarUrl?: string | null }>();

    // 1. Fetch by "ALL" target
    if (dto.targetType === 'ALL') {
      const activeTenures = await this.prisma.userTenure.findMany({
        where: {
          status: { in: [MemberStatus.ACTIVE, MemberStatus.PROBATION] },
          tenure: { isArchived: false },
        },
        include: {
          user: {
            select: { id: true, fullName: true, email: true, avatarUrl: true },
          },
        },
      });

      for (const t of activeTenures) {
        if (t.user && t.user.email) {
          recipientMap.set(t.user.id, t.user);
        }
      }
    }

    // 2. Fetch by Departments
    if (dto.targetDepartmentCodes && dto.targetDepartmentCodes.length > 0) {
      const deptTenures = await this.prisma.userTenure.findMany({
        where: {
          department: {
            code: { in: dto.targetDepartmentCodes as any },
          },
          status: { in: [MemberStatus.ACTIVE, MemberStatus.PROBATION] },
          tenure: { isArchived: false },
        },
        include: {
          user: {
            select: { id: true, fullName: true, email: true, avatarUrl: true },
          },
        },
      });

      for (const t of deptTenures) {
        if (t.user && t.user.email) {
          recipientMap.set(t.user.id, t.user);
        }
      }
    }

    // 3. Fetch specific user IDs
    if (dto.targetUserIds && dto.targetUserIds.length > 0) {
      const specificUsers = await this.prisma.user.findMany({
        where: {
          id: { in: dto.targetUserIds },
        },
        select: { id: true, fullName: true, email: true, avatarUrl: true },
      });

      for (const u of specificUsers) {
        if (u.email) {
          recipientMap.set(u.id, u);
        }
      }
    }

    const recipients = Array.from(recipientMap.values());

    if (recipients.length === 0) {
      throw new BadRequestException('Không tìm thấy thành viên nhận thông báo cuộc họp.');
    }

    // Format human-readable time range
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      weekday: 'long',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const timeFormatted = timeFormatter.format(start);

    // 4. Create In-App Notifications for all recipients
    const notificationMessage = `Thời gian: ${timeFormatted}.\nĐịa điểm: ${dto.location || (dto.meetingUrl ? 'Google Meet' : 'Chưa xác định')}${dto.description ? `\nNội dung: ${dto.description}` : ''}`;
    
    await this.prisma.notification.createMany({
      data: recipients.map((r) => ({
        title: `📅 Lịch họp: ${dto.title}`,
        message: notificationMessage,
        type: NotificationType.EVENT,
        priority: NotificationPriority.IMPORTANT,
        targetUserId: r.id,
        link: dto.meetingUrl || null,
        senderId: sender.id,
      })),
    });

    this.logger.log(`Created ${recipients.length} in-app meeting notifications for "${dto.title}".`);

    // 5. Asynchronously dispatch Calendar Email Invitations in background
    this.sendCalendarEmailsInBackground(recipients, dto, sender);

    return {
      success: true,
      recipientCount: recipients.length,
      message: `Đã thiết lập lịch họp thành công và phát thông báo tới ${recipients.length} thành viên!`,
      recipients: recipients.map((r) => ({ id: r.id, fullName: r.fullName, email: r.email })),
    };
  }

  /**
   * Background batch sender for calendar email invites
   */
  private async sendCalendarEmailsInBackground(
    recipients: { id: string; fullName: string; email: string }[],
    dto: DispatchMeetingDto,
    sender: any,
  ) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    const organizerName = sender.fullName || 'Ban Chủ Nhiệm GDGoC';
    const organizerEmail = sender.email;

    const BATCH_SIZE = 5;
    let deliveredCount = 0;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((r) =>
          this.mailService.sendMeetingInvite({
            title: dto.title,
            description: dto.description,
            startTime: start,
            endTime: end,
            location: dto.location,
            meetingUrl: dto.meetingUrl,
            organizerName,
            organizerEmail,
            recipientName: r.fullName,
            recipientEmail: r.email,
          }),
        ),
      );

      deliveredCount += results.filter((res) => res.status === 'fulfilled' && res.value === true).length;
    }

    this.logger.log(`Dispatched ${deliveredCount}/${recipients.length} calendar emails for "${dto.title}".`);
  }
}
