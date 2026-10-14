import {
  BadRequestException,
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
import { randomUUID } from 'node:crypto';
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
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(726110)`;
      const found = await tx.event.findUnique({ where: { id }, include: { contributions: true, tenure: true, semester: true } });
      if (!found) throw new NotFoundException('Không tìm thấy sự kiện.');
      const event = this.format(found);
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
      await tx.event.update({
        where: { id },
        data: {
          ...data,
          ...(startTime && { startTime: new Date(startTime) }),
          ...(endTime && { endTime: new Date(endTime) }),
        },
        include: { contributions: true, tenure: true, semester: true },
      }),
    );
    });
  }
  private async revokeEventGems(tx: Prisma.TransactionClient, event: any, actorId?: string, userId?: string) {
    const balances = await tx.gemsTransaction.groupBy({
      by: ['userId', 'semesterId'],
      where: { referenceId: event.id, type: GemsTransactionType.EVENT_CONTRIBUTION, ...(userId ? { userId } : {}) },
      _sum: { amount: true },
    });
    for (const balance of balances) {
      const amount = balance._sum.amount || 0;
      if (amount <= 0) continue;
      await tx.gemsTransaction.create({ data: {
        userId: balance.userId, actorId, semesterId: balance.semesterId,
        type: GemsTransactionType.EVENT_CONTRIBUTION, referenceId: event.id,
        amount: -amount, reason: 'Thu hồi đóng góp sự kiện: ' + event.title,
        idempotencyKey: 'event-revoke:' + randomUUID(),
      } });
      await tx.user.update({ where: { id: balance.userId }, data: { gemsBalance: { decrement: amount } } });
    }
  }

  async remove(id: string, actorId?: string) {
    await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(726110)`;
      const event = await tx.event.findUnique({ where: { id }, include: { semester: true, tenure: true } });
      if (!event) throw new NotFoundException('Không tìm thấy sự kiện.');
      await this.revokeEventGems(tx, event, actorId);
      await tx.task.updateMany({ where: { eventId: id }, data: { eventId: null } });
      await tx.driveAsset.updateMany({ where: { eventId: id }, data: { eventId: null } });
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
  async addContributor(eventId: string, dto: AddContributorDto, actorId?: string) {
    const result = await this.assignContributors(eventId, [dto.userId], dto.roleInEvent, dto.notes, actorId);
    return result.contributors[0];
  }

  async addContributors(eventId: string, dto: AddContributorsDto, actorId?: string) {
    const result = await this.assignContributors(eventId, dto.userIds, dto.roleInEvent, undefined, actorId);
    return { addedCount: result.addedCount, skippedCount: result.skippedCount, rewardedCount: result.rewardedCount };
  }

  private async assignContributors(eventId: string, userIds: string[], roleInEvent?: string, notes?: string, actorId?: string) {
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(726110)`;
      const event = await tx.event.findUnique({ where: { id: eventId }, include: { semester: true, tenure: true } });
      if (!event) throw new NotFoundException('Không tìm thấy sự kiện.');
      if (event.semester.isClosed || event.tenure.isArchived || event.tenure.isFrozen)
        throw new BadRequestException('Kỳ đã chốt, không thể chỉnh người đóng góp.');
      const ids = [...new Set(userIds)];
      const count = await tx.userTenure.count({ where: { tenureId: event.tenureId, userId: { in: ids }, status: { in: ['ACTIVE', 'PROBATION'] } } });
      if (count !== ids.length) throw new BadRequestException('Danh sách có thành viên không hoạt động trong nhiệm kỳ này. Chưa lưu thay đổi.');
      let addedCount = 0;
      let rewardedCount = 0;
      for (const userId of ids) {
        let contribution = await tx.eventContribution.findUnique({ where: { eventId_userId: { eventId, userId } } });
        if (!contribution) {
          contribution = await tx.eventContribution.create({ data: { eventId, userId, roleInEvent: roleInEvent?.trim() || null, notes } });
          addedCount++;
        }
        if (contribution.isGemsGranted) continue;
        await tx.gemsTransaction.create({ data: {
          userId, actorId, semesterId: event.semesterId,
          amount: event.contributionGems, type: GemsTransactionType.EVENT_CONTRIBUTION,
          referenceId: eventId, reason: 'Đóng góp sự kiện: ' + event.title,
          idempotencyKey: 'event-contribution:' + contribution.id,
        } });
        await tx.user.update({ where: { id: userId }, data: { gemsBalance: { increment: event.contributionGems } } });
        await tx.eventContribution.update({ where: { id: contribution.id }, data: { isGemsGranted: true } });
        rewardedCount++;
      }
      const contributors = await tx.eventContribution.findMany({ where: { eventId, userId: { in: ids } }, include: { user: { select: { id: true, fullName: true, email: true, mssv: true } } } });
      return { addedCount, skippedCount: ids.length - addedCount, rewardedCount, contributors };
    });
  }

  async removeContributor(eventId: string, userId: string, actorId?: string) {
    await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(726110)`;
      const event = await tx.event.findUnique({ where: { id: eventId }, include: { semester: true, tenure: true } });
      if (!event) throw new NotFoundException('Không tìm thấy sự kiện.');
      if (event.semester.isClosed || event.tenure.isArchived || event.tenure.isFrozen)
        throw new BadRequestException('Kỳ đã chốt, không thể chỉnh người đóng góp.');
      const contribution = await tx.eventContribution.findUnique({ where: { eventId_userId: { eventId, userId } } });
      if (!contribution) throw new NotFoundException('Không tìm thấy người đóng góp.');
      await this.revokeEventGems(tx, event, actorId, userId);
      await tx.eventContribution.delete({ where: { id: contribution.id } });
    });
  }
  private validateTime(start: string, end: string) {
    if (new Date(end) <= new Date(start))
      throw new BadRequestException(
        'Thời gian kết thúc phải sau thời gian bắt đầu.',
      );
  }
}
