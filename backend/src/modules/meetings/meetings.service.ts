import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { DispatchMeetingDto } from './dto/dispatch-meeting.dto';
import { MemberStatus, NotificationPriority, NotificationType, Role } from '@prisma/client';
import { canWork, currentMembership, isLevelOne } from '../common/access';
import { google } from 'googleapis';
import { randomUUID } from 'crypto';

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
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

    // 4. Auto-generate Google Meet link via Google Calendar API if requested or needed
    if (!dto.meetingUrl && (dto.autoGenerateMeet || dto.location?.toLowerCase().includes('meet'))) {
      const generatedMeetUrl = await this.generateGoogleMeetLink({
        title: dto.title,
        startTime: start,
        endTime: end,
        attendeeEmails: recipients.map((r) => r.email),
        description: dto.description,
      });

      if (generatedMeetUrl) {
        dto.meetingUrl = generatedMeetUrl;
        dto.location = 'Google Meet';
      }
    }

    // 5. Create In-App Notifications for all recipients
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

    // 6. Asynchronously dispatch Calendar Email Invitations in background
    this.sendCalendarEmailsInBackground(recipients, dto, sender);

    return {
      success: true,
      recipientCount: recipients.length,
      meetingUrl: dto.meetingUrl || null,
      message: `Đã thiết lập lịch họp thành công và phát thông báo tới ${recipients.length} thành viên!`,
      recipients: recipients.map((r) => ({ id: r.id, fullName: r.fullName, email: r.email })),
    };
  }

  /**
   * Generates a Google Meet link via Google Calendar API conferenceData
   */
  async generateGoogleMeetLink(params: {
    title: string;
    startTime: Date;
    endTime: Date;
    attendeeEmails?: string[];
    description?: string;
  }): Promise<string | null> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const refreshToken = this.configService.get<string>('GOOGLE_REFRESH_TOKEN');

    const saEmail = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    const saKey = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');

    let authClient: any = null;

    if (clientId && clientSecret && refreshToken) {
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      authClient = oauth2Client;
    } else if (saEmail && saKey) {
      authClient = new google.auth.JWT({
        email: saEmail,
        key: saKey.replace(/\\n/g, '\n'),
        scopes: [
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.events',
        ],
      });
    }

    if (!authClient) {
      this.logger.log('Google Calendar API credentials not set; skipping automatic server-side Meet creation.');
      return null;
    }

    try {
      const calendar = google.calendar({ version: 'v3', auth: authClient });
      const calendarId = this.configService.get<string>('GOOGLE_CALENDAR_ID') || 'primary';

      const res = await calendar.events.insert({
        calendarId,
        conferenceDataVersion: 1,
        requestBody: {
          summary: params.title,
          description: params.description,
          start: {
            dateTime: params.startTime.toISOString(),
            timeZone: 'Asia/Ho_Chi_Minh',
          },
          end: {
            dateTime: params.endTime.toISOString(),
            timeZone: 'Asia/Ho_Chi_Minh',
          },
          attendees: (params.attendeeEmails || []).map((email) => ({ email })),
          conferenceData: {
            createRequest: {
              requestId: randomUUID(),
              conferenceSolutionKey: {
                type: 'hangoutsMeet',
              },
            },
          },
        },
      });

      const uri = res.data.hangoutLink || res.data.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri;
      if (uri) {
        this.logger.log(`Successfully generated Google Meet link via Google Calendar API: ${uri}`);
        return uri;
      }
      return null;
    } catch (err: any) {
      this.logger.error(`Failed to generate Google Meet link via Calendar API: ${err?.message || err}`);
      return null;
    }
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

