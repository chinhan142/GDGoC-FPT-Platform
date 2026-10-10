import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MilestoneStatItemDto, UpdateStatsDto } from './dto/update-stats.dto';
import { MemberStatus, Role, TaskStatus } from '@prisma/client';

@Injectable()
export class CmsService {
  private readonly logger = new Logger(CmsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get impact milestone stats for Landing Page (Persistent in DB)
   */
  async getStats() {
    // 1. Kiểm tra cấu hình đã lưu trong DB
    const savedConfig = await this.prisma.landingConfig.findUnique({
      where: { key: 'milestone_stats' },
    });

    if (savedConfig && Array.isArray(savedConfig.data) && savedConfig.data.length > 0) {
      return savedConfig.data;
    }

    // 2. Nếu chưa có, tính toán realtime từ DB
    const [eventsCount, attendanceCount, membersCount, doneTasksCount] =
      await Promise.all([
        this.prisma.event.count({ where: { isPublic: true } }),
        this.prisma.eventAttendance.count({ where: { isVerified: true } }),
        this.prisma.user.count(),
        this.prisma.task.count({ where: { status: TaskStatus.DONE } }),
      ]);

    const defaultStats = [
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

    // Lưu khởi tạo vào database để duy trì tính nhất quán
    try {
      await this.prisma.landingConfig.upsert({
        where: { key: 'milestone_stats' },
        create: {
          key: 'milestone_stats',
          data: defaultStats,
        },
        update: {
          data: defaultStats,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to seed default stats to LandingConfig: ${err}`);
    }

    return defaultStats;
  }

  /**
   * Update custom milestone stats (LEAD only - Persistent in DB)
   */
  async updateStats(dto: UpdateStatsDto) {
    const updated = await this.prisma.landingConfig.upsert({
      where: { key: 'milestone_stats' },
      create: {
        key: 'milestone_stats',
        data: dto.stats as any,
      },
      update: {
        data: dto.stats as any,
      },
    });

    this.logger.log(`Persisted CMS impact milestone statistics to database`);
    return updated.data;
  }

  /**
   * Get Core Team Organizers for Landing Page (Persistent in DB)
   */
  async getOrganizers() {
    // 1. Kiểm tra cấu hình Core Team đã lưu trong DB
    const savedConfig = await this.prisma.landingConfig.findUnique({
      where: { key: 'core_organizers' },
    });

    if (savedConfig && Array.isArray(savedConfig.data)) {
      return savedConfig.data;
    }

    // 2. Nếu chưa có cấu hình tùy chỉnh, lấy danh sách Leads/Core Team từ Active Tenure
    const activeTenure = await this.prisma.tenure.findFirst({
      where: { isFrozen: false },
      orderBy: { startDate: 'desc' },
    });

    if (!activeTenure) {
      return [];
    }

    const organizersFromDb = await this.prisma.userTenure.findMany({
      where: {
        tenureId: activeTenure.id,
        OR: [
          { role: { in: [Role.LEAD, Role.DEPARTMENT_LEAD, Role.ADVISOR] } },
          { department: { code: 'EXECUTIVE' } },
        ],
        status: { in: [MemberStatus.ACTIVE, MemberStatus.PROBATION] },
      },
      include: {
        user: true,
        department: true,
      },
      orderBy: [
        { role: 'asc' },
        { department: { code: 'asc' } },
        { user: { fullName: 'asc' } },
      ],
    });

    const initialOrganizers = organizersFromDb.map((org) => {
      let domain = 'Leads';
      const deptCode = org.department?.code;
      if (
        deptCode === 'TECH_AI' ||
        deptCode === 'TECH_CLOUD' ||
        deptCode === 'TECH_WEB' ||
        deptCode === 'TECH_RESEARCH'
      ) {
        domain = 'Tech';
      } else if (deptCode === 'MEDIA') {
        domain = 'Design & Media';
      } else if (deptCode === 'HR_EVENT') {
        domain = 'Event Operations';
      }

      return {
        id: org.user.id,
        name: org.user.fullName,
        role: org.position || org.role,
        domain,
        major: 'Kỹ thuật phần mềm',
        cohort: org.skills?.[1] || 'K18',
        bio: org.bio || `Core Team Leader @ GDG on Campus FPT University HCMC`,
        avatarUrl: org.user.avatarUrl || null,
        githubUrl: org.user.githubUrl,
        linkedinUrl: org.user.linkedinUrl,
      };
    });

    if (initialOrganizers.length > 0) {
      try {
        await this.prisma.landingConfig.upsert({
          where: { key: 'core_organizers' },
          create: {
            key: 'core_organizers',
            data: initialOrganizers,
          },
          update: {
            data: initialOrganizers,
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to seed initial organizers to LandingConfig: ${err}`);
      }
    }

    return initialOrganizers;
  }

  /**
   * Update Core Team Organizers for Landing Page (LEAD only - Persistent in DB)
   */
  async updateOrganizers(organizers: any[]) {
    const updated = await this.prisma.landingConfig.upsert({
      where: { key: 'core_organizers' },
      create: {
        key: 'core_organizers',
        data: organizers,
      },
      update: {
        data: organizers,
      },
    });

    this.logger.log(`Persisted ${organizers.length} Core Team members for Landing Page to database`);
    return updated.data;
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
