import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGiftDto } from './dto/create-gift.dto';
import { UpdateGiftDto } from './dto/update-gift.dto';
import { RedeemGiftDto } from './dto/redeem-gift.dto';
import { QueryRedemptionsDto } from './dto/query-redemptions.dto';
import { UpdateRedemptionStatusDto } from './dto/update-redemption-status.dto';
import {
  GemsTransactionType,
  Prisma,
  RedemptionStatus,
  Role,
} from '@prisma/client';

@Injectable()
export class GiftsService {
  private readonly logger = new Logger(GiftsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get list of all available gift items
   */
  async findAllGifts() {
    return this.prisma.giftItem.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get single gift item by ID
   */
  async findOneGift(id: string) {
    const gift = await this.prisma.giftItem.findUnique({
      where: { id },
    });

    if (!gift) {
      throw new NotFoundException(`Gift item with ID ${id} not found`);
    }

    return gift;
  }

  /**
   * Create new gift item (LEAD only)
   */
  async createGift(dto: CreateGiftDto) {
    return this.prisma.giftItem.create({
      data: dto,
    });
  }

  /**
   * Update gift item (LEAD only)
   */
  async updateGift(id: string, dto: UpdateGiftDto) {
    await this.findOneGift(id);

    return this.prisma.giftItem.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Delete gift item (LEAD only)
   */
  async removeGift(id: string) {
    await this.findOneGift(id);

    return this.prisma.giftItem.delete({
      where: { id },
    });
  }

  /**
   * Submit gift redemption request
   * Atomic operation: Check balance -> Deduct Gems -> Decrease Stock -> Create Redemption & Transaction
   */
  async redeemGift(userId: string, dto: RedeemGiftDto) {
    const gift = await this.findOneGift(dto.giftItemId);

    if (!gift.isActive) {
      throw new BadRequestException('Món quà này hiện đang tạm ngừng đổi.');
    }

    if (gift.stock <= 0) {
      throw new BadRequestException('Món quà này hiện đã hết hàng trong kho.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.gemsBalance < gift.gemsPrice) {
      throw new BadRequestException(
        `Số dư Gems không đủ! Bạn có ${user.gemsBalance} Gems, cần ${gift.gemsPrice} Gems để đổi món quà này.`,
      );
    }

    const idempotencyKey = `gift_redeem_${gift.id}_${userId}_${Date.now()}`;

    return this.prisma.$transaction(async (tx) => {
      // 1. Deduct Gems from User
      await tx.user.update({
        where: { id: userId },
        data: {
          gemsBalance: {
            decrement: gift.gemsPrice,
          },
        },
      });

      // 2. Decrease Stock by 1
      await tx.giftItem.update({
        where: { id: gift.id },
        data: {
          stock: {
            decrement: 1,
          },
        },
      });

      // 3. Record in Gems Ledger
      await tx.gemsTransaction.create({
        data: {
          userId,
          amount: -gift.gemsPrice,
          type: GemsTransactionType.GIFT_REDEMPTION,
          referenceId: gift.id,
          reason: `Đổi quà tặng: ${gift.name}`,
          idempotencyKey,
        },
      });

      // 4. Create GiftRedemption record
      const redemption = await tx.giftRedemption.create({
        data: {
          userId,
          giftItemId: gift.id,
          gemsSpent: gift.gemsPrice,
          status: RedemptionStatus.PENDING,
        },
        include: {
          giftItem: true,
          user: {
            select: {
              id: true,
              fullName: true,
              mssv: true,
              email: true,
              gemsBalance: true,
            },
          },
        },
      });

      this.logger.log(
        `User ${userId} redeemed gift ${gift.name} (${gift.id}) for ${gift.gemsPrice} gems.`,
      );

      return redemption;
    });
  }

  /**
   * Get list of gift redemptions (Member views own, LEAD views all)
   */
  async findRedemptions(user: any, query: QueryRedemptionsDto) {
    const { status, page = 1, limit = 20 } = query;

    const isLead = user.tenures?.some((t: any) => t.role === Role.LEAD);

    const where: Prisma.GiftRedemptionWhereInput = {};

    if (!isLead) {
      where.userId = user.id;
    }

    if (status) {
      where.status = status;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.giftRedemption.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          giftItem: true,
          user: {
            select: {
              id: true,
              fullName: true,
              mssv: true,
              email: true,
              avatarUrl: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      }),
      this.prisma.giftRedemption.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update redemption status (LEAD only)
   * If REJECTED -> Auto refund Gems to user & restore item stock
   */
  async updateRedemptionStatus(
    adminId: string,
    id: string,
    dto: UpdateRedemptionStatusDto,
  ) {
    const redemption = await this.prisma.giftRedemption.findUnique({
      where: { id },
      include: {
        giftItem: true,
        user: true,
      },
    });

    if (!redemption) {
      throw new NotFoundException(`Redemption request with ID ${id} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      // If moving to REJECTED from PENDING / APPROVED -> Refund Gems and Stock
      if (
        dto.status === RedemptionStatus.REJECTED &&
        redemption.status !== RedemptionStatus.REJECTED
      ) {
        // 1. Refund user Gems
        await tx.user.update({
          where: { id: redemption.userId },
          data: {
            gemsBalance: {
              increment: redemption.gemsSpent,
            },
          },
        });

        // 2. Restore gift stock
        await tx.giftItem.update({
          where: { id: redemption.giftItemId },
          data: {
            stock: {
              increment: 1,
            },
          },
        });

        // 3. Record refund transaction
        const refundKey = `refund_gift_${redemption.id}_${Date.now()}`;
        await tx.gemsTransaction.create({
          data: {
            userId: redemption.userId,
            amount: redemption.gemsSpent,
            type: GemsTransactionType.MANUAL_ADJUSTMENT,
            referenceId: redemption.id,
            reason: `Hoàn lại Gems do đơn đổi quà "${redemption.giftItem.name}" bị từ chối`,
            idempotencyKey: refundKey,
          },
        });

        this.logger.log(
          `Refunded ${redemption.gemsSpent} gems to user ${redemption.userId} due to rejected redemption ${id}`,
        );
      }

      // Update redemption record
      return tx.giftRedemption.update({
        where: { id },
        data: {
          status: dto.status,
          notes: dto.notes ?? redemption.notes,
          approvedById: adminId,
        },
        include: {
          giftItem: true,
          user: {
            select: {
              id: true,
              fullName: true,
              mssv: true,
              email: true,
              gemsBalance: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      });
    });
  }
}
