import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GemsTransactionType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { activeSemester, canWork, currentMembership } from '../common/access';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { QueryEventDto } from './dto/query-event.dto';
import { AddContributorDto } from './dto/add-contributor.dto';
import { AddContributorsDto } from './dto/add-contributors.dto';
@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}
  private format(event: any) {
    const { contributions = [], ...data } = event;
    return {
      ...data,
      contributorCount: contributions.length,
      rewardedCount: contributions.filter((c: any) => c.isGemsGranted).length,
      tenureName: event.tenure?.name,
      tenureGen: event.tenure?.genLabel,
    };
  }
  myContributionCount(userId: string) { return this.prisma.eventContribution.count({ where: { userId } }).then(count=>({count})); }
  async findOne(id: string, user?: any) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: { contributions: true, tenure: true, semester: true },
    });
    if (!event) throw new NotFoundException('Không tìm thấy sự kiện.');
    if (user && !canWork(currentMembership(user)) && !event.isPublic)
      throw new ForbiddenException(
        'Alumni chỉ xem sự kiện showcase công khai.',
      );
    return this.format(event);
  }
  private async writable(id: string) {
    const event = await this.findOne(id);
    if (
      event.semester.isClosed ||
      event.tenure.isArchived ||
      event.tenure.isFrozen
    )
      throw new BadRequestException(
        'Sự kiện thuộc kỳ đã chốt; chỉ có thể xem lịch sử.',
      );
    return event;
  }
  async create(dto: CreateEventDto) {
    const semester = await activeSemester(this.prisma, dto.tenureId);
    this.validateTime(dto.startTime, dto.endTime);
    const { tenureId, ...data } = dto;
    return this.format(
      await this.prisma.event.create({
        data: {
          ...data,
          startTime: new Date(dto.startTime),
          endTime: new Date(dto.endTime),
          tenureId: semester.tenureId,
          semesterId: semester.id,
        },
        include: { contributions: true, tenure: true, semester: true },
      }),
    );
  }
  async findAll(query?: QueryEventDto, user?: any) {
    const where: Prisma.EventWhereInput = {};
    if (query?.tenureId) where.tenureId = query.tenureId;
    if (query?.isPublic !== undefined) where.isPublic = query.isPublic;
    if (user && !canWork(currentMembership(user))) where.isPublic = true;
    if (query?.type) where.type = query.type;
    if (query?.status === 'upcoming' || query?.status === 'registration_open')
      where.startTime = { gt: new Date() };
    if (query?.status === 'completed') where.endTime = { lt: new Date() };
    if (query?.search)
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { location: { contains: query.search, mode: 'insensitive' } },
      ];
    return (
      await this.prisma.event.findMany({
        where,
        include: { contributions: true, tenure: true, semester: true },
        orderBy: { startTime: 'desc' },
      })
    ).map((e) => this.format(e));
  }
  async update(id: string, dto: UpdateEventDto) {
    const event = await this.findOne(id);
    if ((event.semester.isClosed || event.tenure.isArchived || event.tenure.isFrozen)
      && Object.keys(dto).some(key => !['title', 'description', 'location', 'status', 'isPublic', 'bannerImageUrl', 'registrationUrl', 'driveFolderUrl'].includes(key))) {
      throw new BadRequestException('Kỳ đã chốt: chỉ cập nhật nội dung showcase, không đổi dữ liệu đóng góp/Gems hoặc thời gian sự kiện.');
    }
    if (dto.tenureId && dto.tenureId !== event.tenureId)
      throw new BadRequestException('Không chuyển sự kiện sang nhiệm kỳ khác.');
    if (
      dto.contributionGems !== undefined &&
      dto.contributionGems !== event.contributionGems &&
      event.rewardedCount
    )
      throw new BadRequestException('Không đổi mức Gems sau khi đã cộng điểm.');
    this.validateTime(
      dto.startTime || event.startTime.toISOString(),
      dto.endTime || event.endTime.toISOString(),
    );
    const { tenureId, startTime, endTime, ...data } = dto;
    return this.format(
      await this.prisma.event.update({
        where: { id },
        data: {
          ...data,
          ...(startTime && { startTime: new Date(startTime) }),
          ...(endTime && { endTime: new Date(endTime) }),
        },
        include: { contributions: true, tenure: true, semester: true },
      }),
    );
  }
  async remove(id: string) {
    const event = await this.writable(id);
    if (event.rewardedCount)
      throw new BadRequestException(
        'Sự kiện đã cộng Gems cần giữ để đối soát; có thể ẩn khỏi landing page.',
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.task.updateMany({
        where: { eventId: id },
        data: { eventId: null },
      });
      await tx.driveAsset.updateMany({
        where: { eventId: id },
        data: { eventId: null },
      });
      await tx.event.delete({ where: { id } });
    });
  }
  async getContributors(eventId: string, user?: any) {
    await this.findOne(eventId, user);
    return this.prisma.eventContribution.findMany({
      where: {
        eventId,
        ...(user && !canWork(currentMembership(user))
          ? { userId: user.id }
          : {}),
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, mssv: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
  async addContributor(eventId: string, dto: AddContributorDto) {
    const event = await this.writable(eventId);
    const member = await this.prisma.userTenure.findUnique({
      where: {
        userId_tenureId: { userId: dto.userId, tenureId: event.tenureId },
      },
    });
    if (!member || !['ACTIVE', 'PROBATION'].includes(member.status))
      throw new BadRequestException(
        'Chỉ gán thành viên đang hoạt động trong nhiệm kỳ này.',
      );
    try {
      return await this.prisma.eventContribution.create({
        data: { eventId, ...dto },
        include: {
          user: {
            select: { id: true, fullName: true, email: true, mssv: true },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Thành viên đã có trong danh sách đóng góp.',
        );
      throw error;
    }
  }
  async addContributors(eventId: string, dto: AddContributorsDto) {
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(726110)`;
      const event = await tx.event.findUnique({ where: { id: eventId }, include: { semester: true, tenure: true } });
      if (!event) throw new NotFoundException('Không tìm thấy sự kiện.');
      if (event.semester.isClosed || event.tenure.isArchived || event.tenure.isFrozen)
        throw new BadRequestException('Kỳ đã chốt, không thể thêm người đóng góp.');
      const ids = [...new Set(dto.userIds)];
      const count = await tx.userTenure.count({ where: { tenureId: event.tenureId, userId: { in: ids }, status: { in: ['ACTIVE', 'PROBATION'] } } });
      if (count !== ids.length) throw new BadRequestException('Danh sách có thành viên không hoạt động trong nhiệm kỳ này. Chưa lưu thay đổi.');
      const added = await tx.eventContribution.createMany({ data: ids.map(userId => ({ eventId, userId, roleInEvent: dto.roleInEvent?.trim() || null })), skipDuplicates: true });
      return { addedCount: added.count, skippedCount: ids.length - added.count };
    });
  }
  async removeContributor(eventId: string, userId: string) {
    await this.writable(eventId);
    const contribution = await this.prisma.eventContribution.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!contribution)
      throw new NotFoundException('Không tìm thấy người đóng góp.');
    if (contribution.isGemsGranted)
      throw new BadRequestException('Không xóa đóng góp đã được cộng Gems.');
    await this.prisma.eventContribution.delete({
      where: { id: contribution.id },
    });
  }
  async settleGems(eventId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(726110)`;
      const event = await tx.event.findUnique({
        where: { id: eventId },
        include: { semester: true, tenure: true, contributions: true },
      });
      if (!event) throw new NotFoundException('Không tìm thấy sự kiện.');
      if (
        event.semester.isClosed ||
        event.tenure.isArchived ||
        event.tenure.isFrozen
      )
        throw new BadRequestException('Kỳ đã chốt, không thể cộng thêm Gems.');
      let rewardedCount = 0;
      for (const contribution of event.contributions) {
        if (contribution.isGemsGranted) continue;
        const idempotencyKey =
          'event-contribution:' + eventId + ':' + contribution.userId;
        await tx.gemsTransaction.create({
          data: {
            userId: contribution.userId,
            semesterId: event.semesterId,
            amount: event.contributionGems,
            type: GemsTransactionType.EVENT_CONTRIBUTION,
            referenceId: eventId,
            reason: 'Đóng góp sự kiện: ' + event.title,
            idempotencyKey,
          },
        });
        await tx.user.update({
          where: { id: contribution.userId },
          data: { gemsBalance: { increment: event.contributionGems } },
        });
        await tx.eventContribution.update({
          where: { id: contribution.id },
          data: { isGemsGranted: true },
        });
        rewardedCount++;
      }
      return {
        eventId,
        rewardedCount,
        skippedCount: event.contributions.length - rewardedCount,
      };
    });
  }
  private validateTime(start: string, end: string) {
    if (new Date(end) <= new Date(start))
      throw new BadRequestException(
        'Thời gian kết thúc phải sau thời gian bắt đầu.',
      );
  }
}
