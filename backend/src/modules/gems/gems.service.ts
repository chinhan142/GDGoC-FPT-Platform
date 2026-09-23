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

@Injectable()
export class GemsService {
  private readonly logger = new Logger(GemsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get Gems Leaderboard with weekly delta
   */
  async getLeaderboard(query: QueryLeaderboardDto) {
    const { tenureId, departmentCode, limit = 20 } = query;

    // Determine target tenure
    let tenure = null;
    if (tenureId) {
      tenure = await this.prisma.tenure.findUnique({
        where: { id: tenureId },
      });
    } else {
      tenure = await this.prisma.tenure.findFirst({
        where: { isFrozen: false, isArchived: false },
        orderBy: { startDate: 'desc' },
      });
    }

    const whereTenure: any = {
      status: { in: [MemberStatus.ACTIVE, MemberStatus.PROBATION] },
    };

    if (tenure) {
      whereTenure.tenureId = tenure.id;
    }

    if (departmentCode) {
      whereTenure.department = { code: departmentCode };
    }

    // Get active memberships in this tenure
    const userTenures = await this.prisma.userTenure.findMany({
      where: whereTenure,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            mssv: true,
            avatarUrl: true,
            gemsBalance: true,
          },
        },
        department: {
          select: {
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        user: {
          gemsBalance: 'desc',
        },
      },
      take: limit,
    });

    // 7 days ago timestamp for delta calculation
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Compute ranking with weekly gains (delta)
    const rankings = await Promise.all(
      userTenures.map(async (ut, index) => {
        // Sum gains in last 7 days
        const weeklyGainTx = await this.prisma.gemsTransaction.aggregate({
          where: {
            userId: ut.user.id,
            amount: { gt: 0 },
            createdAt: { gte: sevenDaysAgo },
          },
          _sum: {
            amount: true,
          },
        });

        const weeklyGain = weeklyGainTx._sum.amount || 0;
        const delta =
          weeklyGain > 0
            ? `+${weeklyGain} tuần này`
            : weeklyGain < 0
              ? `${weeklyGain} tuần này`
              : '0 tuần này';

        return {
          rank: index + 1,
          userId: ut.user.id,
          fullName: ut.user.fullName,
          mssv: ut.user.mssv,
          avatarUrl: ut.user.avatarUrl,
          departmentName: ut.department.name,
          departmentCode: ut.department.code,
          gemsBalance: ut.user.gemsBalance,
          delta,
        };
      }),
    );

    return {
      updatedAt: new Date(),
      isFrozen: tenure?.isFrozen ?? false,
      rankings,
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
      const isLead = requesterUser.tenures?.some(
        (t: any) => t.role === Role.LEAD,
      );

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
        where: { userId: targetUserId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.gemsTransaction.count({
        where: { userId: targetUserId },
      }),
    ]);

    return {
      balance: user.gemsBalance,
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

    const idempotencyKey = `manual_adj_${dto.userId}_${Date.now()}`;

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.gemsTransaction.create({
        data: {
          userId: dto.userId,
          amount: dto.amount,
          type: GemsTransactionType.MANUAL_ADJUSTMENT,
          reason: dto.reason,
          idempotencyKey,
        },
      });

      await tx.user.update({
        where: { id: dto.userId },
        data: {
          gemsBalance: {
            increment: dto.amount,
          },
        },
      });

      this.logger.log(
        `Admin ${adminId} adjusted ${dto.amount} gems for user ${dto.userId}. Reason: ${dto.reason}`,
      );

      return transaction;
    });
  }
}
