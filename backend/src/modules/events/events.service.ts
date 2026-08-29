import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

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
