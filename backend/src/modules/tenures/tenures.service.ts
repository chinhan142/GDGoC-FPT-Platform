import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateTenureConfigDto } from './dto/update-tenure-config.dto';
import { TransitionTenureDto } from './dto/transition-tenure.dto';
export function nextSemester(current: { name: string; startDate: Date }) {
  const match = /^(Spring|Summer|Fall)\s+(\d{4})$/i.exec(current.name.trim());
  if (!match)
    throw new BadRequestException(
      'Tên kỳ cần có dạng Spring, Summer hoặc Fall YYYY trước khi chuyển kỳ.',
    );
  const season = match[1].toLowerCase();
  const year = Number(match[2]) + (season === 'fall' ? 1 : 0);
  const next =
    season === 'fall' ? 'Spring' : season === 'spring' ? 'Summer' : 'Fall';
  const month = next === 'Spring' ? 0 : next === 'Summer' ? 4 : 8;
  return {
    name: next + ' ' + year,
    startDate: new Date(Date.UTC(year, month, 1)),
    endDate: new Date(Date.UTC(year, month + 4, 0, 23, 59, 59, 999)),
  };
}
@Injectable()
export class TenuresService {
  constructor(private readonly prisma: PrismaService) {}
  async getGenerationConfig() {
    const currentTenure = await this.prisma.tenure.findFirst({
      where: { isArchived: false },
      orderBy: { startDate: 'desc' },
    });
    const currentSemester = currentTenure
      ? await this.prisma.semester.findFirst({
          where: { tenureId: currentTenure.id, isClosed: false },
          orderBy: { startDate: 'desc' },
        })
      : null;
    const periods = await this.prisma.semester.findMany({
      where: { isClosed: true },
      include: { tenure: true },
      orderBy: { startDate: 'desc' },
    });
    const archivedTenures = await Promise.all(
      periods.map(async (s) => {
        const [totalTasks, gems, membersCount, eventsCount] = await Promise.all(
          [
            this.prisma.task.count({ where: { semesterId: s.id } }),
            this.prisma.gemsTransaction.aggregate({
              where: { semesterId: s.id },
              _sum: { amount: true },
            }),
            this.prisma.userTenure.count({ where: { tenureId: s.tenureId } }),
            this.prisma.event.count({ where: { semesterId: s.id } }),
          ],
        );
        return {
          ...s,
          genLabel: s.tenure.genLabel,
          chapterLead: s.tenure.chapterLead,
          totalTasks,
          totalGems: gems._sum.amount || 0,
          membersCount,
          eventsCount,
          archivedAt: s.endDate,
        };
      }),
    );
    const preferences = currentTenure
      ? await this.prisma.landingConfig.findUnique({
          where: { key: 'generation_settings_' + currentTenure.id },
        })
      : null;
    const settings = (preferences?.data || {}) as any;
    return {
      currentTenure,
      currentSemester,
      nextSemester: currentSemester ? nextSemester(currentSemester) : null,
      allowTaskSubmission: settings.allowTaskSubmission ?? true,
      freezeLeaderboard: !currentSemester || currentSemester.isClosed,
      coChapterLead: settings.coChapterLead || '',
      archivedTenures,
    };
  }
  async updateGenerationConfig(dto: UpdateTenureConfigDto) {
    const tenure = await this.prisma.tenure.findFirst({
      where: { isArchived: false },
      orderBy: { startDate: 'desc' },
    });
    if (!tenure)
      throw new NotFoundException('Chưa có nhiệm kỳ đang hoạt động.');
    const semester = await this.prisma.semester.findFirst({
      where: { tenureId: tenure.id, isClosed: false },
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.tenure.update({
        where: { id: tenure.id },
        data: {
          ...(dto.genLabel && { genLabel: dto.genLabel }),
          ...(dto.chapterLead !== undefined && {
            chapterLead: dto.chapterLead,
          }),
          ...(dto.isFrozen !== undefined && { isFrozen: dto.isFrozen }),
        },
      });
      if (semester) {
        const startDate = dto.startDate
          ? new Date(dto.startDate)
          : semester.startDate;
        const endDate = dto.endDate ? new Date(dto.endDate) : semester.endDate;
        if (endDate <= startDate)
          throw new BadRequestException(
            'Ngày kết thúc kỳ phải sau ngày bắt đầu.',
          );
        if (dto.name) nextSemester({ name: dto.name, startDate });
        await tx.semester.update({
          where: { id: semester.id },
          data: { ...(dto.name && { name: dto.name }), startDate, endDate },
        });
      }
      const key = 'generation_settings_' + tenure.id;
      const existing = await tx.landingConfig.findUnique({ where: { key } });
      const data = {
        ...((existing?.data || {}) as any),
        ...(dto.allowTaskSubmission !== undefined && {
          allowTaskSubmission: dto.allowTaskSubmission,
        }),
        ...(dto.coChapterLead !== undefined && {
          coChapterLead: dto.coChapterLead,
        }),
      };
      delete data.allowRsvp;
      await tx.landingConfig.upsert({
        where: { key },
        create: { key, data },
        update: { data },
      });
    });
    return this.getGenerationConfig();
  }
  async transition(dto: TransitionTenureDto, adminId?: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(726110)`;
      const tenure = await tx.tenure.findFirst({
        where: { isArchived: false, isFrozen: false },
        orderBy: { startDate: 'desc' },
      });
      if (!tenure)
        throw new BadRequestException('Chưa có nhiệm kỳ đang hoạt động.');
      const semester = await tx.semester.findFirst({
        where: { tenureId: tenure.id, isClosed: false },
        orderBy: { startDate: 'desc' },
      });
      if (!semester)
        throw new BadRequestException('Chưa có kỳ đang hoạt động.');
      const pending = await tx.task.count({
        where: { semesterId: semester.id, status: { not: 'DONE' } },
      });
      if (pending)
        throw new BadRequestException(
          'Còn ' +
            pending +
            ' công việc chưa hoàn thành. Hãy xử lý trước khi chốt kỳ.',
        );
      const unrewarded = await tx.eventContribution.count({
        where: { isGemsGranted: false, event: { semesterId: semester.id } },
      });
      if (unrewarded)
        throw new BadRequestException(
          'Còn đóng góp sự kiện chưa cộng Gems. Hãy duyệt trước khi chốt kỳ.',
        );
      let next = nextSemester(semester);
      await tx.semester.update({
        where: { id: semester.id },
        data: { isClosed: true },
      });
      let tenureId = tenure.id;
      if (dto.kind === 'tenure') {
        await tx.tenure.update({
          where: { id: tenure.id },
          data: { isArchived: true, isFrozen: true },
        });
        const yearMatch = /(\d{4})\s*[-–]\s*(\d{4})/.exec(tenure.name);
        const year = yearMatch
          ? Number(yearMatch[1]) + 1
          : Math.max(
              next.startDate.getUTCFullYear(),
              tenure.startDate.getUTCFullYear() + 1,
            );
        const annualStart = new Date(tenure.startDate);
        annualStart.setUTCFullYear(year);
        const annualEnd = new Date(annualStart);
        annualEnd.setUTCFullYear(year + 1);
        annualEnd.setTime(annualEnd.getTime() - 1);
        const month = Math.floor(annualStart.getUTCMonth() / 4) * 4;
        const season = month === 0 ? 'Spring' : month === 4 ? 'Summer' : 'Fall';
        next = { name: season + ' ' + year, startDate: annualStart, endDate: new Date(Date.UTC(year, month + 4, 0, 23, 59, 59, 999)) };
        const created = await tx.tenure.create({ data: { name: year + '-' + (year + 1), genLabel: year + '-' + (year + 1), startDate: annualStart, endDate: annualEnd } });
        tenureId = created.id;
        const memberships = await tx.userTenure.findMany({
          where: { tenureId: tenure.id },
        });
        await tx.userTenure.createMany({
          data: memberships.map(({ id, tenureId: oldId, ...m }) => ({
            ...m,
            tenureId,
          })),
        });
      }
      await tx.semester.create({ data: { ...next, tenureId } });
    });
    return this.getGenerationConfig();
  }
  findAll() {
    return this.prisma.tenure.findMany({ orderBy: { startDate: 'desc' } });
  }
}
