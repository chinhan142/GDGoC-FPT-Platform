import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DepartmentType, GemsTransactionType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { AddEventOrganizerDto } from './dto/add-event-organizer.dto';

const PROFESSIONAL_DEPARTMENT_TYPES: DepartmentType[] = [
  DepartmentType.TECH,
  DepartmentType.MEDIA,
  DepartmentType.PR_COMMS,
  DepartmentType.HR_EVENT,
];

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createEventDto: CreateEventDto) {
    this.validateTimeRange(createEventDto.startTime, createEventDto.endTime);

    return this.prisma.event.create({
      data: {
        ...createEventDto,
        startTime: new Date(createEventDto.startTime),
        endTime: new Date(createEventDto.endTime),
      },
    });
  }

  findAll() {
    return this.prisma.event.findMany({
      orderBy: { startTime: 'asc' },
    });
  }

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
        throw new NotFoundException(`Event with ID ${eventId} was not found.`);
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
        'Organizers must represent one of the four professional departments.',
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

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} was not found.`);
    }

    return event;
  }

  async update(id: string, updateEventDto: UpdateEventDto) {
    this.validateRequiredFieldsNotNull(updateEventDto);

    const event = await this.findOne(id);
    const startTime = updateEventDto.startTime ?? event.startTime.toISOString();
    const endTime = updateEventDto.endTime ?? event.endTime.toISOString();

    this.validateTimeRange(startTime, endTime);

    return this.prisma.event.update({
      where: { id },
      data: {
        ...updateEventDto,
        ...(updateEventDto.startTime && {
          startTime: new Date(updateEventDto.startTime),
        }),
        ...(updateEventDto.endTime && {
          endTime: new Date(updateEventDto.endTime),
        }),
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.event.delete({ where: { id } });
  }

  private validateTimeRange(startTime: string, endTime: string): void {
    if (new Date(endTime) <= new Date(startTime)) {
      throw new BadRequestException('endTime must be later than startTime.');
    }
  }

  private validateRequiredFieldsNotNull(updateEventDto: UpdateEventDto): void {
    const requiredFields: (keyof UpdateEventDto)[] = [
      'title',
      'type',
      'location',
      'startTime',
      'endTime',
      'attendeeGems',
      'organizerGems',
      'tenureId',
    ];

    const nullField = requiredFields.find(
      (field) => updateEventDto[field] === null,
    );

    if (nullField) {
      throw new BadRequestException(`${nullField} cannot be null.`);
    }
  }
}
