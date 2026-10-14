import {
  isLevelOne,
  currentMembership,
  canWork,
  activeSemester,
} from '../common/access';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryLeaderboardDto } from './dto/query-leaderboard.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { AdjustGemsDto } from './dto/adjust-gems.dto';
import { GemsTransactionType, MemberStatus, Role } from '@prisma/client';
import { randomUUID } from 'node:crypto';

@Injectable()
export class GemsService {
  private readonly logger = new Logger(GemsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get Gems Leaderboard with weekly delta
   */
  async getLeaderboard(query: QueryLeaderboardDto) {
    const semester = query.semesterId
      ? await this.prisma.semester.findUnique({
          where: { id: query.semesterId },
        })
      : await this.prisma.semester.findFirst({
          where: { isClosed: false, tenure: { isArchived: false } },
          orderBy: { startDate: 'desc' },
        });
    if (!semester)
      return {
        rankings: [],
        isFrozen: true,
        updatedAt: new Date(),
        semester: null,
      };
    const memberships = await this.prisma.userTenure.findMany({
      where: {
        tenureId: semester.tenureId,
        ...(query.departmentCode && {
          department: { code: query.departmentCode },
        }),
      },
      include: {
        user: {
          select: { id: true, fullName: true, mssv: true, avatarUrl: true },
        },
        department: true,
      },
    });
    const totals = await this.prisma.gemsTransaction.groupBy({
      by: ['userId'],
      where: { semesterId: semester.id },
      _sum: { amount: true },
    });
    const weekly = await this.prisma.gemsTransaction.groupBy({
      by: ['userId'],
      where: {
        semesterId: semester.id,
        createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
      },
      _sum: { amount: true },
    });
    const completed = await this.prisma.taskAssignee.groupBy({
      by: ['userId'],
      where: { task: { semesterId: semester.id, status: 'DONE' } },
      _count: { _all: true },
    });
    const rankings = memberships
      .map((m) => ({
        tasksCompleted:
          completed.find((c) => c.userId === m.userId)?._count._all || 0,
        userId: m.user.id,
        fullName: m.user.fullName,
        mssv: m.user.mssv,
        avatarUrl: m.user.avatarUrl,
        departmentName: m.department.name,
        departmentCode: m.department.code,
        gemsBalance:
          totals.find((t) => t.userId === m.userId)?._sum.amount || 0,
        delta:
          String(weekly.find((t) => t.userId === m.userId)?._sum.amount || 0) +
          ' tuần này',
      }))
      .sort(
        (a, b) =>
          b.gemsBalance - a.gemsBalance || a.fullName.localeCompare(b.fullName),
      )
      .slice(0, query.limit || 20)
      .map((m, index, sorted) => ({
        ...m,
        rank: m.gemsBalance > 0 ? sorted.findIndex(other => other.gemsBalance === m.gemsBalance) + 1 : null,
      }));
    return {
      rankings,
      semester,
      isFrozen: semester.isClosed,
      updatedAt: new Date(),
    };
  }

  /**
   * Get transaction history for current user or specific user (LEAD)
   */
  async getTransactions(requesterUser: any, query: QueryTransactionsDto) {
    const { userId, page = 1, limit = 20 } = query;

    let targetUserId = requesterUser.id;

    if (userId && userId !== requesterUser.id) {
      // Verify if requester is LEAD
      const m = currentMembership(requesterUser);
      const isLead = canWork(m) && isLevelOne(m.role);

      if (!isLead) {
        throw new ForbiddenException(
          'Chỉ Ban Chủ Nhiệm (LEAD) mới có quyền xem lịch sử giao dịch của thành viên khác.',
        );
      }

      targetUserId = userId;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, fullName: true, gemsBalance: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${targetUserId} not found`);
    }

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.gemsTransaction.findMany({
        where: {
          userId: targetUserId,
          ...(query.semesterId && { semesterId: query.semesterId }),
        },
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { actor: { select: { id: true, fullName: true } } },
      }),
      this.prisma.gemsTransaction.count({
        where: { userId: targetUserId, ...(query.semesterId && { semesterId: query.semesterId }) },
      }),
    ]);

    return {
      balance: query.semesterId
        ? (
            await this.prisma.gemsTransaction.aggregate({
              where: { userId: targetUserId, semesterId: query.semesterId },
              _sum: { amount: true },
            })
          )._sum.amount || 0
        : user.gemsBalance,
      lifetimeBalance: user.gemsBalance,
      transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Manually adjust Gems for a member (LEAD only)
   */
  async adjustGems(adminId: string, dto: AdjustGemsDto) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!targetUser) {
      throw new NotFoundException(`User with ID ${dto.userId} not found`);
    }

    // Guard against negative balance if penalty is larger than balance
    if (dto.amount < 0 && targetUser.gemsBalance + dto.amount < 0) {
      throw new BadRequestException(
        `Số dư Gems hiện tại (${targetUser.gemsBalance}) không đủ để thực hiện khấu trừ ${Math.abs(dto.amount)} Gems.`,
      );
    }

    const semester = await activeSemester(this.prisma);
    const membership = await this.prisma.userTenure.findUnique({
      where: {
        userId_tenureId: { userId: dto.userId, tenureId: semester.tenureId },
      },
    });
    if (!canWork(membership))
      throw new BadRequestException(
        'Không điều chỉnh Gems cho Alumni hoặc tài khoản không thuộc nhiệm kỳ hiện tại.',
      );
    const idempotencyKey = `manual_adj_${randomUUID()}`;

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(726110)`;
      const current = await tx.semester.findUnique({
        where: { id: semester.id },
      });
      if (!current || current.isClosed)
        throw new BadRequestException('Kỳ đã chốt.');
      const updated = await tx.user.updateMany({
        where: {
          id: dto.userId,
          ...(dto.amount < 0 && { gemsBalance: { gte: -dto.amount } }),
        },
        data: { gemsBalance: { increment: dto.amount } },
      });
      if (!updated.count)
        throw new BadRequestException('Số dư không đủ để khấu trừ.');
      const transaction = await tx.gemsTransaction.create({
        data: {
          userId: dto.userId,
          amount: dto.amount,
          type: GemsTransactionType.MANUAL_ADJUSTMENT,
          actorId: adminId,
          semesterId: semester.id,
          reason: dto.reason,
          idempotencyKey,
        },
        include: { actor: { select: { id: true, fullName: true } } },
      });

      this.logger.log(
        `Admin ${adminId} adjusted ${dto.amount} gems for user ${dto.userId}. Reason: ${dto.reason}`,
      );

      return transaction;
    });
  }
}
