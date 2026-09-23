import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateTenureConfigDto } from './dto/update-tenure-config.dto';
import { TransitionTenureDto } from './dto/transition-tenure.dto';
import {
  NotificationPriority,
  NotificationType,
  Role,
  TaskStatus,
} from '@prisma/client';

@Injectable()
export class TenuresService {
  private readonly logger = new Logger(TenuresService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get active generation config with archived snapshot metrics
   */
  async getGenerationConfig() {
    const currentTenure = await this.prisma.tenure.findFirst({
      where: { isArchived: false },
      orderBy: { startDate: 'desc' },
    });

    const otherTenures = await this.prisma.tenure.findMany({
      where: currentTenure ? { id: { not: currentTenure.id } } : {},
      orderBy: { startDate: 'desc' },
    });

    // Compute metrics snapshot for archived tenures
    const archivedTenures = await Promise.all(
      otherTenures.map(async (t) => {
        const [totalTasks, doneTasksGems, membersCount, eventsCount] =
          await Promise.all([
            this.prisma.task.count({ where: { tenureId: t.id } }),
            this.prisma.task.aggregate({
              where: { tenureId: t.id, status: TaskStatus.DONE },
              _sum: { gemsReward: true },
            }),
            this.prisma.userTenure.count({ where: { tenureId: t.id } }),
            this.prisma.event.count({ where: { tenureId: t.id } }),
          ]);

        return {
          id: t.id,
          name: t.name,
          genLabel: t.genLabel,
          chapterLead: t.chapterLead,
          totalTasks,
          totalGems: doneTasksGems._sum.gemsReward || 0,
          membersCount,
          eventsCount,
          archivedAt: t.endDate,
        };
      }),
    );

    return {
      currentTenure: currentTenure
        ? {
            id: currentTenure.id,
            name: currentTenure.name,
            genLabel: currentTenure.genLabel,
            startDate: currentTenure.startDate,
            endDate: currentTenure.endDate,
            isFrozen: currentTenure.isFrozen,
            chapterLead: currentTenure.chapterLead,
          }
        : null,
      allowTaskSubmission: currentTenure ? !currentTenure.isFrozen : false,
      allowRsvp: true,
      freezeLeaderboard: currentTenure ? currentTenure.isFrozen : false,
      archivedTenures,
    };
  }

  /**
   * Update active tenure config
   */
  async updateGenerationConfig(dto: UpdateTenureConfigDto) {
    const currentTenure = await this.prisma.tenure.findFirst({
      where: { isArchived: false },
      orderBy: { startDate: 'desc' },
    });

    if (!currentTenure) {
      throw new NotFoundException('Không tìm thấy nhiệm kỳ đang hoạt động');
    }

    const updated = await this.prisma.tenure.update({
      where: { id: currentTenure.id },
      data: {
        isFrozen: dto.isFrozen !== undefined ? dto.isFrozen : currentTenure.isFrozen,
        chapterLead: dto.chapterLead || currentTenure.chapterLead,
      },
    });

    return {
      currentTenure: updated,
      allowTaskSubmission: dto.allowTaskSubmission !== undefined ? dto.allowTaskSubmission : !updated.isFrozen,
      allowRsvp: dto.allowRsvp !== undefined ? dto.allowRsvp : true,
      freezeLeaderboard: dto.freezeLeaderboard !== undefined ? dto.freezeLeaderboard : updated.isFrozen,
    };
  }

  /**
   * Transition from current tenure to a new tenure (Hero Feature)
   */
  async transition(dto: TransitionTenureDto, adminId?: string) {
    const currentTenure = await this.prisma.tenure.findFirst({
      where: { isArchived: false },
      orderBy: { startDate: 'desc' },
    });

    return this.prisma.$transaction(async (tx) => {
      let snapshot = null;

      if (currentTenure) {
        // 1. Archive & freeze current tenure
        await tx.tenure.update({
          where: { id: currentTenure.id },
          data: {
            isFrozen: true,
            isArchived: true,
          },
        });

        // 2. Compute snapshot
        const [totalTasks, doneTasksGems, membersCount, eventsCount] =
          await Promise.all([
            tx.task.count({ where: { tenureId: currentTenure.id } }),
            tx.task.aggregate({
              where: { tenureId: currentTenure.id, status: TaskStatus.DONE },
              _sum: { gemsReward: true },
            }),
            tx.userTenure.count({ where: { tenureId: currentTenure.id } }),
            tx.event.count({ where: { tenureId: currentTenure.id } }),
          ]);

        snapshot = {
          totalTasks,
          totalGems: doneTasksGems._sum.gemsReward || 0,
          membersCount,
          eventsCount,
        };
      }

      // 3. Create new tenure
      const newTenure = await tx.tenure.create({
        data: {
          name: dto.newTenureName,
          genLabel: dto.newGenLabel,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          chapterLead: dto.chapterLead || currentTenure?.chapterLead,
          isFrozen: false,
          isArchived: false,
        },
      });

      // 4. Carry over Core Team
      if (dto.carryOverCoreTeam && currentTenure) {
        const coreTeam = await tx.userTenure.findMany({
          where: {
            tenureId: currentTenure.id,
            role: { in: [Role.LEAD, Role.DEPARTMENT_LEAD, Role.ADVISOR] },
          },
        });

        if (coreTeam.length > 0) {
          await tx.userTenure.createMany({
            data: coreTeam.map((m) => ({
              userId: m.userId,
              tenureId: newTenure.id,
              departmentId: m.departmentId,
              role: m.role,
              status: m.status,
              position: m.position,
              skills: m.skills,
            })),
            skipDuplicates: true,
          });
        }
      }

      // 5. Notify all members
      if (dto.notifyAllMembers) {
        let senderUserId = adminId;
        if (!senderUserId) {
          const firstLead = await tx.user.findFirst();
          senderUserId = firstLead?.id;
        }

        if (senderUserId) {
          await tx.notification.create({
            data: {
              title: `🎉 Chào Mừng Nhiệm Kỳ Mới: ${newTenure.name} (${newTenure.genLabel})`,
              message: `CLB GDGoC FPTU chính thức bước sang nhiệm kỳ mới. Chúc toàn thể thành viên một kỳ hoạt động bùng nổ và gặt hái nhiều thành công!`,
              type: NotificationType.BROADCAST,
              priority: NotificationPriority.URGENT,
              targetDepartmentId: null,
              link: '/app/profile',
              senderId: senderUserId,
            },
          });
        }
      }

      this.logger.log(
        `Successfully transitioned to new tenure ${newTenure.name} (${newTenure.id})`,
      );

      return {
        archived: currentTenure
          ? {
              tenureId: currentTenure.id,
              snapshot,
            }
          : null,
        newTenure,
      };
    });
  }

  /**
   * Get all tenures
   */
  async findAll() {
    return this.prisma.tenure.findMany({
      orderBy: { startDate: 'desc' },
    });
  }
}
