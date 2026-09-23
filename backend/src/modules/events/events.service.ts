import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CheckinMethod,
  DepartmentType,
  GemsTransactionType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { AddEventOrganizerDto } from './dto/add-event-organizer.dto';
import { QueryEventDto } from './dto/query-event.dto';
import { AddAttendeeDto } from './dto/add-attendee.dto';
import { ToggleCheckinDto } from './dto/toggle-checkin.dto';

const PROFESSIONAL_DEPARTMENT_TYPES: DepartmentType[] = [
  DepartmentType.TECH_AI,
  DepartmentType.TECH_CLOUD,
  DepartmentType.TECH_WEB,
  DepartmentType.TECH_RESEARCH,
  DepartmentType.MEDIA,
  DepartmentType.HR_EVENT,
  DepartmentType.EXECUTIVE,
];

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  private formatEventResponse(event: any) {
    const attendances = event.attendances || [];
    const attendeeCount = attendances.length;
    const checkedInCount = attendances.filter((a: any) => a.isVerified).length;

    const { attendances: _, ...eventData } = event;
    return {
      ...eventData,
      attendeeCount,
      checkedInCount,
    };
  }

  async create(createEventDto: CreateEventDto) {
    this.validateTimeRange(createEventDto.startTime, createEventDto.endTime);

    const tenure = await this.prisma.tenure.findUnique({
      where: { id: createEventDto.tenureId },
    });
    if (!tenure) {
      throw new NotFoundException(
        `Nhiệm kỳ '${createEventDto.tenureId}' không tồn tại.`,
      );
    }

    const event = await this.prisma.event.create({
      data: {
        title: createEventDto.title,
        description: createEventDto.description,
        type: createEventDto.type,
        location: createEventDto.location,
        startTime: new Date(createEventDto.startTime),
        endTime: new Date(createEventDto.endTime),
        attendeeGems: createEventDto.attendeeGems ?? 20,
        organizerGems: createEventDto.organizerGems ?? 100,
        driveFolderUrl: createEventDto.driveFolderUrl,
        bannerImageUrl: createEventDto.bannerImageUrl,
        registrationUrl: createEventDto.registrationUrl,
        isPublic: createEventDto.isPublic ?? false,
        tenureId: createEventDto.tenureId,
      },
      include: {
        attendances: true,
      },
    });

    return this.formatEventResponse(event);
  }

  async findAll(query?: QueryEventDto) {
    const where: Prisma.EventWhereInput = {};

    if (query?.tenureId) {
      where.tenureId = query.tenureId;
    }

    if (query?.isPublic !== undefined) {
      where.isPublic = query.isPublic;
    }

    if (query?.type) {
      where.type = query.type;
    }

    const now = new Date();
    if (query?.status === 'upcoming') {
      where.startTime = { gt: now };
    } else if (query?.status === 'completed') {
      where.endTime = { lt: now };
    } else if (query?.status === 'registration_open') {
      where.startTime = { gt: now };
      where.OR = [
        { registrationUrl: { not: null } },
        { isPublic: true },
      ];
    }

    if (query?.search) {
      const s = query.search.trim();
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { location: { contains: s, mode: 'insensitive' } },
      ];
    }

    const events = await this.prisma.event.findMany({
      where,
      include: {
        attendances: true,
      },
      orderBy: { startTime: 'asc' },
    });

    return events.map((ev) => this.formatEventResponse(ev));
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        attendances: true,
      },
    });

    if (!event) {
      throw new NotFoundException(`Sự kiện với ID '${id}' không tồn tại.`);
    }

    return this.formatEventResponse(event);
  }

  async update(id: string, updateEventDto: UpdateEventDto) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Sự kiện với ID '${id}' không tồn tại.`);
    }

    const startTime = updateEventDto.startTime ?? event.startTime.toISOString();
    const endTime = updateEventDto.endTime ?? event.endTime.toISOString();

    this.validateTimeRange(startTime, endTime);

    const updated = await this.prisma.event.update({
      where: { id },
      data: {
        ...(updateEventDto.title !== undefined && { title: updateEventDto.title }),
        ...(updateEventDto.description !== undefined && { description: updateEventDto.description }),
        ...(updateEventDto.type !== undefined && { type: updateEventDto.type }),
        ...(updateEventDto.location !== undefined && { location: updateEventDto.location }),
        ...(updateEventDto.startTime && { startTime: new Date(updateEventDto.startTime) }),
        ...(updateEventDto.endTime && { endTime: new Date(updateEventDto.endTime) }),
        ...(updateEventDto.attendeeGems !== undefined && { attendeeGems: updateEventDto.attendeeGems }),
        ...(updateEventDto.organizerGems !== undefined && { organizerGems: updateEventDto.organizerGems }),
        ...(updateEventDto.driveFolderUrl !== undefined && { driveFolderUrl: updateEventDto.driveFolderUrl }),
        ...(updateEventDto.bannerImageUrl !== undefined && { bannerImageUrl: updateEventDto.bannerImageUrl }),
        ...(updateEventDto.registrationUrl !== undefined && { registrationUrl: updateEventDto.registrationUrl }),
        ...(updateEventDto.isPublic !== undefined && { isPublic: updateEventDto.isPublic }),
        ...(updateEventDto.tenureId !== undefined && { tenureId: updateEventDto.tenureId }),
      },
      include: {
        attendances: true,
      },
    });

    return this.formatEventResponse(updated);
  }

  async remove(id: string): Promise<void> {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Sự kiện với ID '${id}' không tồn tại.`);
    }

    await this.prisma.event.delete({ where: { id } });
  }

  // ==========================================
  // ATTENDEES & CHECK-IN OPERATIONS
  // ==========================================

  async getAttendees(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Sự kiện với ID '${eventId}' không tồn tại.`);
    }

    const attendances = await this.prisma.eventAttendance.findMany({
      where: { eventId },
      include: {
        user: {
          include: {
            tenures: {
              where: { tenureId: event.tenureId },
              include: { department: true },
            },
          },
        },
      },
      orderBy: { checkinTime: 'asc' },
    });

    const totalRegistered = attendances.length;
    const totalCheckedIn = attendances.filter((a) => a.isVerified).length;
    const attendanceRate =
      totalRegistered > 0
        ? Math.round((totalCheckedIn / totalRegistered) * 100)
        : 0;

    const attendees = attendances.map((att) => {
      const userTenure = att.user?.tenures?.[0];
      return {
        id: att.id,
        userId: att.userId,
        fullName: att.user?.fullName || 'Khách tham dự',
        mssv: att.user?.mssv || 'N/A',
        email: att.user?.email || 'N/A',
        departmentName: userTenure?.department?.name || 'Khách ngoài',
        checkedIn: att.isVerified,
        checkinTime: att.checkinTime,
        checkinMethod: att.checkinMethod,
        evidenceImageUrl: att.evidenceImageUrl,
        isVerified: att.isVerified,
        notes: att.notes,
      };
    });

    return {
      eventId,
      totalRegistered,
      totalCheckedIn,
      attendanceRate,
      attendees,
    };
  }

  async addAttendee(
    eventId: string,
    dto: AddAttendeeDto,
    verifiedById?: string,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Sự kiện với ID '${eventId}' không tồn tại.`);
    }

    let targetUserId = dto.userId;

    // If userId not given, check or create guest user
    if (!targetUserId) {
      if (!dto.guestEmail && !dto.guestMssv) {
        throw new BadRequestException(
          'Vui lòng cung cấp userId hoặc thông tin khách mời (email/mssv, họ tên).',
        );
      }

      let guestUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            ...(dto.guestEmail ? [{ email: dto.guestEmail }] : []),
            ...(dto.guestMssv ? [{ mssv: dto.guestMssv }] : []),
          ],
        },
      });

      if (!guestUser) {
        const guestMssv = dto.guestMssv || `GUEST_${Date.now()}`;
        guestUser = await this.prisma.user.create({
          data: {
            mssv: guestMssv,
            fullName: dto.guestName || 'Khách mời',
            email: dto.guestEmail || `guest_${Date.now()}@fpt.edu.vn`,
            passwordHash: 'GUEST_NO_LOGIN',
          },
        });
      }

      targetUserId = guestUser.id;
    }

    // Check if attendance already exists
    const existing = await this.prisma.eventAttendance.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId: targetUserId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'Người này đã có tên trong danh sách tham dự sự kiện.',
      );
    }

    const attendance = await this.prisma.eventAttendance.create({
      data: {
        eventId,
        userId: targetUserId,
        checkinMethod: dto.checkinMethod || CheckinMethod.MANUAL_EVIDENCE,
        isVerified: dto.isVerified ?? true,
        verifiedById,
        notes: dto.notes,
      },
      include: {
        user: true,
      },
    });

    return attendance;
  }

  async toggleCheckin(
    eventId: string,
    attendeeId: string,
    dto: ToggleCheckinDto,
    verifiedById?: string,
  ) {
    let attendance = await this.prisma.eventAttendance.findUnique({
      where: { id: attendeeId },
    });

    if (!attendance) {
      attendance = await this.prisma.eventAttendance.findFirst({
        where: { eventId, userId: attendeeId },
      });
    }

    if (!attendance || attendance.eventId !== eventId) {
      throw new NotFoundException(
        `Không tìm thấy bản ghi điểm danh với ID '${attendeeId}'.`,
      );
    }

    const updated = await this.prisma.eventAttendance.update({
      where: { id: attendance.id },
      data: {
        isVerified: dto.checkedIn,
        checkinTime: new Date(),
        verifiedById: dto.checkedIn ? verifiedById : null,
        evidenceImageUrl: dto.evidenceImageUrl ?? attendance.evidenceImageUrl,
        notes: dto.notes ?? attendance.notes,
      },
      include: {
        user: true,
      },
    });

    return updated;
  }

  async removeAttendee(eventId: string, attendeeId: string): Promise<void> {
    let attendance = await this.prisma.eventAttendance.findUnique({
      where: { id: attendeeId },
    });

    if (!attendance) {
      attendance = await this.prisma.eventAttendance.findFirst({
        where: { eventId, userId: attendeeId },
      });
    }

    if (!attendance || attendance.eventId !== eventId) {
      throw new NotFoundException(
        `Không tìm thấy người tham dự với ID '${attendeeId}'.`,
      );
    }

    await this.prisma.eventAttendance.delete({
      where: { id: attendance.id },
    });
  }

  // ==========================================
  // ORGANIZERS & GEMS SETTLEMENT
  // ==========================================

  settleOrganizerGems(eventId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const event = await transaction.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          title: true,
          organizerGems: true,
        },
      });

      if (!event) {
        throw new NotFoundException(`Sự kiện ID ${eventId} không tồn tại.`);
      }

      const organizers = await transaction.eventOrganizer.findMany({
        where: { eventId },
        select: {
          id: true,
          userId: true,
          isGemsGranted: true,
        },
        orderBy: { id: 'asc' },
      });

      let rewardedCount = 0;
      let skippedCount = 0;

      for (const organizer of organizers) {
        if (organizer.isGemsGranted) {
          skippedCount += 1;
          continue;
        }

        const idempotencyKey = `event-organizer:${eventId}:${organizer.userId}`;
        const existingTransaction =
          await transaction.gemsTransaction.findUnique({
            where: { idempotencyKey },
            select: { id: true },
          });

        if (existingTransaction) {
          await transaction.eventOrganizer.updateMany({
            where: {
              id: organizer.id,
              isGemsGranted: false,
            },
            data: { isGemsGranted: true },
          });
          skippedCount += 1;
          continue;
        }

        const claimedOrganizer = await transaction.eventOrganizer.updateMany({
          where: {
            id: organizer.id,
            isGemsGranted: false,
          },
          data: { isGemsGranted: true },
        });

        if (claimedOrganizer.count === 0) {
          skippedCount += 1;
          continue;
        }

        await transaction.gemsTransaction.create({
          data: {
            userId: organizer.userId,
            amount: event.organizerGems,
            type: GemsTransactionType.EVENT_ORGANIZER,
            referenceId: eventId,
            reason: `Organizer reward for event: ${event.title}`,
            idempotencyKey,
          },
        });

        await transaction.user.update({
          where: { id: organizer.userId },
          data: {
            gemsBalance: { increment: event.organizerGems },
          },
        });

        rewardedCount += 1;
      }

      return {
        eventId,
        rewardedCount,
        skippedCount,
      };
    });
  }

  async addOrganizer(
    eventId: string,
    addEventOrganizerDto: AddEventOrganizerDto,
  ) {
    const event = await this.findOne(eventId);
    const { userId, departmentId, roleInEvent } = addEventOrganizerDto;

    const [user, department, existingAssignment, membership] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true },
        }),
        this.prisma.department.findUnique({
          where: { id: departmentId },
          select: { id: true, code: true },
        }),
        this.prisma.eventOrganizer.findUnique({
          where: { eventId_userId: { eventId, userId } },
          select: { id: true },
        }),
        this.prisma.userTenure.findFirst({
          where: {
            userId,
            departmentId,
            tenureId: event.tenureId,
          },
          select: { id: true },
        }),
      ]);

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} was not found.`);
    }

    if (!department) {
      throw new NotFoundException(
        `Department with ID ${departmentId} was not found.`,
      );
    }

    if (existingAssignment) {
      throw new ConflictException(
        `User with ID ${userId} is already an organizer for this event.`,
      );
    }

    if (!PROFESSIONAL_DEPARTMENT_TYPES.includes(department.code)) {
      throw new BadRequestException(
        'Organizers must represent one of the professional departments.',
      );
    }

    if (!membership) {
      throw new BadRequestException(
        'The user does not belong to the selected department for the event tenure.',
      );
    }

    try {
      return await this.prisma.eventOrganizer.create({
        data: {
          eventId,
          userId,
          departmentId,
          roleInEvent,
        },
        include: {
          user: {
            select: {
              id: true,
              mssv: true,
              email: true,
              fullName: true,
            },
          },
          department: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `User with ID ${userId} is already an organizer for this event.`,
        );
      }

      throw error;
    }
  }

  async findOrganizers(eventId: string) {
    await this.findOne(eventId);

    return this.prisma.eventOrganizer.findMany({
      where: { eventId },
      select: {
        id: true,
        eventId: true,
        userId: true,
        departmentId: true,
        roleInEvent: true,
        isGemsGranted: true,
        user: {
          select: {
            id: true,
            mssv: true,
            email: true,
            fullName: true,
          },
        },
        department: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });
  }

  async removeOrganizer(eventId: string, userId: string): Promise<void> {
    const assignment = await this.prisma.eventOrganizer.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { id: true },
    });

    if (!assignment) {
      throw new NotFoundException(
        `Organizer assignment for event ${eventId} and user ${userId} was not found.`,
      );
    }

    await this.prisma.eventOrganizer.delete({
      where: { eventId_userId: { eventId, userId } },
    });
  }

  private validateTimeRange(startTime: string, endTime: string): void {
    if (new Date(endTime) <= new Date(startTime)) {
      throw new BadRequestException(
        'Thời gian kết thúc (endTime) phải sau thời gian bắt đầu (startTime).',
      );
    }
  }
}
