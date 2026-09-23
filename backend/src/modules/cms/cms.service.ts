import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MilestoneStatItemDto, UpdateStatsDto } from './dto/update-stats.dto';
import { TaskStatus } from '@prisma/client';

@Injectable()
export class CmsService {
  private readonly logger = new Logger(CmsService.name);
  private customStats: MilestoneStatItemDto[] | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get impact milestone stats for Landing Page
   */
  async getStats() {
    if (this.customStats && this.customStats.length > 0) {
      return this.customStats;
    }

    // Compute realtime statistics from Database
    const [eventsCount, attendanceCount, membersCount, doneTasksCount] =
      await Promise.all([
        this.prisma.event.count({ where: { isPublic: true } }),
        this.prisma.eventAttendance.count({ where: { isVerified: true } }),
        this.prisma.user.count(),
        this.prisma.task.count({ where: { status: TaskStatus.DONE } }),
      ]);

    return [
      {
        label: 'Hoạt Động & Sự Kiện',
        value: `${Math.max(eventsCount, 12)}+`,
        description: 'Workshop, Hackathon, Codelab & Showcase',
        accentColor: '#4285F4', // Google Blue
      },
      {
        label: 'Lượt Sinh Viên Tham Gia',
        value: `${Math.max(attendanceCount, 500)}+`,
        description: 'Sinh viên FPTU & cộng đồng yêu công nghệ',
        accentColor: '#34A853', // Google Green
      },
      {
        label: 'Thành Viên Nòng Cốt',
        value: `${Math.max(membersCount, 50)}+`,
        description: 'Core Team & 7 Ban Chuyên Môn vững mạnh',
        accentColor: '#FBBC05', // Google Yellow
      },
      {
        label: 'Nhiệm Vụ Đã Nghiệm Thu',
        value: `${Math.max(doneTasksCount, 150)}+`,
        description: 'Dự án thực tế & đóng góp mã nguồn mở',
        accentColor: '#EA4335', // Google Red
      },
    ];
  }

  /**
   * Update custom milestone stats (LEAD only)
   */
  async updateStats(dto: UpdateStatsDto) {
    this.customStats = dto.stats;
    this.logger.log(`Updated CMS impact milestone statistics`);
    return this.customStats;
  }

  /**
   * Get public events for Landing Page
   */
  async getPublicEvents() {
    const events = await this.prisma.event.findMany({
      where: { isPublic: true },
      orderBy: { startTime: 'desc' },
      include: {
        attendances: {
          select: { id: true, isVerified: true },
        },
      },
    });

    return events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      type: e.type,
      location: e.location,
      startTime: e.startTime,
      endTime: e.endTime,
      attendeeGems: e.attendeeGems,
      organizerGems: e.organizerGems,
      isPublic: e.isPublic,
      bannerImageUrl: e.bannerImageUrl,
      registrationUrl: e.registrationUrl,
      attendeeCount: e.attendances.length,
      checkedInCount: e.attendances.filter((a) => a.isVerified).length,
    }));
  }
}
