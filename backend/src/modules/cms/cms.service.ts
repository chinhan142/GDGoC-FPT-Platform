import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MilestoneStatItemDto, UpdateStatsDto } from './dto/update-stats.dto';
import { MemberStatus, Role, TaskStatus } from '@prisma/client';

@Injectable()
export class CmsService {
  private readonly logger = new Logger(CmsService.name);

  // In-memory cache to prevent excessive DB queries during traffic spikes
  private statsCache: { data: any; expiresAt: number } | null = null;
  private organizersCache: { data: any; expiresAt: number } | null = null;
  private eventsCache: { data: any; expiresAt: number } | null = null;
  private tenureCache: { data: any; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get impact milestone stats for Landing Page (Persistent in DB)
   */
  async getStats() {
    if (this.statsCache && this.statsCache.expiresAt > Date.now()) {
      return this.statsCache.data;
    }

    // 1. Kiểm tra cấu hình đã lưu trong DB
    const savedConfig = await this.prisma.landingConfig.findUnique({
      where: { key: 'milestone_stats' },
    });

    if (savedConfig && Array.isArray(savedConfig.data)) {
      this.statsCache = { data: savedConfig.data, expiresAt: Date.now() + 60_000 };
      return savedConfig.data;
    }

    // 2. Nếu chưa có, tính toán realtime từ DB
    const [eventsCount, attendanceCount, membersCount, doneTasksCount] =
      await Promise.all([
        this.prisma.event.count({ where: { isPublic: true } }),
        this.prisma.eventContribution.count(),
        this.prisma.user.count(),
        this.prisma.task.count({ where: { status: TaskStatus.DONE } }),
      ]);

    const defaultStats = [
      {
        label: 'Hoạt Động & Sự Kiện',
        value: `${eventsCount}`,
        description: 'Workshop, Hackathon, Codelab & Showcase',
        accentColor: '#4285F4', // Google Blue
      },
      {
        label: 'Lượt Đóng Góp Nội Bộ',
        value: `${attendanceCount}`,
        description: 'Thành viên đóng góp tổ chức sự kiện',
        accentColor: '#34A853', // Google Green
      },
      {
        label: 'Thành Viên Nòng Cốt',
        value: `${membersCount}`,
        description: 'Core Team & 7 Ban Chuyên Môn vững mạnh',
        accentColor: '#FBBC05', // Google Yellow
      },
      {
        label: 'Nhiệm Vụ Đã Nghiệm Thu',
        value: `${doneTasksCount}`,
        description: 'Dự án thực tế & đóng góp mã nguồn mở',
        accentColor: '#EA4335', // Google Red
      },
    ];

    this.statsCache = { data: defaultStats, expiresAt: Date.now() + 60_000 };
    return defaultStats;
  }

  /**
   * Update custom milestone stats (LEAD only - Persistent in DB)
   */
  async updateStats(dto: UpdateStatsDto) {
    this.statsCache = null; // Invalidate cache immediately on update
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
    if (this.organizersCache && this.organizersCache.expiresAt > Date.now()) {
      return this.organizersCache.data;
    }

    // 1. Kiểm tra cấu hình Core Team đã lưu trong DB
    const savedConfig = await this.prisma.landingConfig.findUnique({
      where: { key: 'core_organizers' },
    });

    if (savedConfig && Array.isArray(savedConfig.data)) {
      const userIds = savedConfig.data
        .map((org: any) => org.id)
        .filter((id: any): id is string => typeof id === 'string' && id.length > 0);

      const users =
        userIds.length > 0
          ? await this.prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, avatarUrl: true },
            })
          : [];

      const avatarMap = new Map(users.map((u) => [u.id, u.avatarUrl]));

      const result = savedConfig.data.map((org: any) => ({
        ...org,
        avatarUrl: avatarMap.get(org.id) || org.avatarUrl,
      }));

      this.organizersCache = { data: result, expiresAt: Date.now() + 60_000 };
      return result;
    }

    // 2. Nếu chưa có cấu hình tùy chỉnh, lấy danh sách Leads/Core Team từ Active Tenure
    const activeTenure = await this.prisma.tenure.findFirst({
      where: { isFrozen: false, isArchived: false },
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
        major: '',
        cohort: org.skills?.find((s) => /^K\d+$/i.test(s)) || '',
        bio: org.bio || `Core Team Leader @ GDG on Campus FPT University HCMC`,
        avatarUrl: org.user.avatarUrl || null,
        githubUrl: org.user.githubUrl,
        linkedinUrl: org.user.linkedinUrl,
      };
    });

    this.organizersCache = { data: initialOrganizers, expiresAt: Date.now() + 60_000 };
    return initialOrganizers;
  }

  /**
   * Update Core Team Organizers for Landing Page (LEAD only - Persistent in DB)
   */
  async updateOrganizers(organizers: any[]) {
    this.organizersCache = null; // Invalidate cache immediately on update
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
    if (this.eventsCache && this.eventsCache.expiresAt > Date.now()) {
      return this.eventsCache.data;
    }

    const events = await this.prisma.event.findMany({
      where: { isPublic: true },
      orderBy: { startTime: 'desc' },
    });

    const result = events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      type: e.type,
      location: e.location,
      startTime: e.startTime,
      endTime: e.endTime,
      contributionGems: e.contributionGems,
      isPublic: e.isPublic,
      bannerImageUrl: e.bannerImageUrl,
      registrationUrl: e.registrationUrl,
    }));

    this.eventsCache = { data: result, expiresAt: Date.now() + 60_000 };
    return result;
  }

  /**
   * Lấy thông tin niên khóa hiện tại phục vụ hiển thị công khai (Public)
   */
  async getCurrentTenure() {
    if (this.tenureCache && this.tenureCache.expiresAt > Date.now()) {
      return this.tenureCache.data;
    }

    const tenure = await this.prisma.tenure.findFirst({
      where: { isFrozen: false, isArchived: false },
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
      },
    });

    let result: { id?: string; name?: string; academicYear: string };

    if (!tenure) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const startYear = now.getMonth() >= 8 ? currentYear : currentYear - 1;
      result = {
        academicYear: `${startYear} - ${startYear + 1}`,
      };
    } else {
      const startYear = new Date(tenure.startDate).getFullYear();
      const endYear = new Date(tenure.endDate).getFullYear();
      const academicYear =
        startYear === endYear ? `${startYear} - ${startYear + 1}` : `${startYear} - ${endYear}`;

      result = {
        id: tenure.id,
        name: tenure.name,
        academicYear,
      };
    }

    this.tenureCache = { data: result, expiresAt: Date.now() + 300_000 };
    return result;
  }
}

