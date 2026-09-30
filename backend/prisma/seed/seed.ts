import 'dotenv/config';
import {
  PrismaClient,
  DepartmentType,
  Role,
  MemberStatus,
  TaskStatus,
  TaskPriority,
  EventType,
  CheckinMethod,
  DriveCategory,
  AccessLevel,
  GemsTransactionType,
  RedemptionStatus,
  NotificationType,
  NotificationPriority,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in environment variables');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting comprehensive database seeding for GDGoC Platform...');

  const defaultPassword = 'GDGoC@2026';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // 1. Seed 7 Departments
  console.log('1️⃣ Seeding 7 Departments...');
  const departmentsData = [
    { code: DepartmentType.EXECUTIVE, name: 'Ban Chủ Nhiệm', nameEn: 'Executive Board' },
    { code: DepartmentType.TECH_AI, name: 'Ban Trí Tuệ Nhân Tạo', nameEn: 'AI Engineering' },
    { code: DepartmentType.TECH_CLOUD, name: 'Ban Điện Toán Đám Mây', nameEn: 'Cloud Engineering' },
    { code: DepartmentType.TECH_WEB, name: 'Ban Phát Triển Web', nameEn: 'Web Development' },
    { code: DepartmentType.TECH_RESEARCH, name: 'Ban Nghiên Cứu & Học Thuật', nameEn: 'Research & Academics' },
    { code: DepartmentType.MEDIA, name: 'Ban Truyền Thông & Thiết Kế', nameEn: 'Media & Design' },
    { code: DepartmentType.HR_EVENT, name: 'Ban Nhân Sự & Tổ Chức Sự Kiện', nameEn: 'HR & Event Operations' },
  ];

  const deptMap = new Map<DepartmentType, string>();
  for (const dept of departmentsData) {
    const upserted = await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name, nameEn: dept.nameEn },
      create: { code: dept.code, name: dept.name, nameEn: dept.nameEn },
    });
    deptMap.set(dept.code, upserted.id);
  }

  // 2. Seed Tenures
  console.log('2️⃣ Seeding Tenures...');
  const activeTenure = await prisma.tenure.upsert({
    where: { id: 'tenure-fall-2026' },
    update: { isFrozen: false, isArchived: false },
    create: {
      id: 'tenure-fall-2026',
      name: 'Fall 2026',
      genLabel: 'Gen 4.0',
      chapterLead: 'Đặng Mai Phương',
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2027-01-31T23:59:59.000Z'),
      isFrozen: false,
      isArchived: false,
    },
  });

  const archivedTenure = await prisma.tenure.upsert({
    where: { id: 'tenure-summer-2026' },
    update: { isFrozen: true, isArchived: true },
    create: {
      id: 'tenure-summer-2026',
      name: 'Summer 2026',
      genLabel: 'Gen 3.5',
      chapterLead: 'Nguyễn Văn An',
      startDate: new Date('2026-05-01T00:00:00.000Z'),
      endDate: new Date('2026-08-31T23:59:59.000Z'),
      isFrozen: true,
      isArchived: true,
    },
  });

  // 3. Seed Users & UserTenures
  console.log('3️⃣ Seeding Test Accounts (Roles & Departments)...');
  const usersData = [
    {
      mssv: 'SE180001',
      email: 'lead@gdgfptu.dev',
      fullName: 'Đặng Mai Phương',
      role: Role.LEAD,
      deptCode: DepartmentType.EXECUTIVE,
      position: 'Chapter Lead',
      bio: 'Lead GDGoC FPTU HCMC Gen 4.0. Đam mê xây dựng cộng đồng công nghệ sinh viên năng động.',
      skills: ['Community Leadership', 'Product Management', 'Google Cloud', 'System Architecture'],
      gems: 450,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    },
    {
      mssv: 'AD100001',
      email: 'advisor@gdgfptu.dev',
      fullName: 'ThS. Trần Hoàng Nam',
      role: Role.ADVISOR,
      deptCode: DepartmentType.EXECUTIVE,
      position: 'Giảng viên Cố vấn CLB',
      bio: 'Cố vấn chuyên môn và định hướng chiến lược GDGoC FPT University HCMC.',
      skills: ['Mentorship', 'Curriculum Design', 'AI Research', 'Academic Outreach'],
      gems: 100,
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    },
    {
      mssv: 'SE180002',
      email: 'ai.lead@gdgfptu.dev',
      fullName: 'Lê Hoàng Long',
      role: Role.DEPARTMENT_LEAD,
      deptCode: DepartmentType.TECH_AI,
      position: 'AI Department Lead',
      bio: 'Trưởng ban AI. Yêu thích Generative AI, LLMs, Computer Vision và Kaggle.',
      skills: ['PyTorch', 'TensorFlow', 'LLM Agentic Systems', 'LangChain', 'Python'],
      gems: 320,
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    },
    {
      mssv: 'SE180003',
      email: 'web.lead@gdgfptu.dev',
      fullName: 'Phạm Gia Huy',
      role: Role.DEPARTMENT_LEAD,
      deptCode: DepartmentType.TECH_WEB,
      position: 'Web Department Lead',
      bio: 'Trưởng ban Web. Chuyên sâu Fullstack TypeScript, NestJS, React, Next.js & DevOps.',
      skills: ['TypeScript', 'React 19', 'NestJS', 'PostgreSQL', 'Docker', 'TailwindCSS'],
      gems: 380,
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
    },
    {
      mssv: 'SE180004',
      email: 'hr.lead@gdgfptu.dev',
      fullName: 'Nguyễn Thảo Vy',
      role: Role.DEPARTMENT_LEAD,
      deptCode: DepartmentType.HR_EVENT,
      position: 'HR & Event Lead',
      bio: 'Trưởng ban HR-Event. Chuyên tổ chức sự kiện quy mô lớn, điều phối nhân sự và check-in.',
      skills: ['Event Planning', 'HR Operations', 'Public Speaking', 'Crisis Management'],
      gems: 290,
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    },
    {
      mssv: 'SE180005',
      email: 'media.lead@gdgfptu.dev',
      fullName: 'Trần Minh Quân',
      role: Role.DEPARTMENT_LEAD,
      deptCode: DepartmentType.MEDIA,
      position: 'Media & Design Lead',
      bio: 'Trưởng ban Truyền thông. Chịu trách nhiệm thiết kế visual, video recap và social media.',
      skills: ['Figma', 'Adobe Premiere', 'Brand Identity', 'Content Strategy'],
      gems: 260,
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    },
    {
      mssv: 'SE180006',
      email: 'member.ai@gdgfptu.dev',
      fullName: 'Vũ Đức Thành',
      role: Role.MEMBER,
      deptCode: DepartmentType.TECH_AI,
      position: 'AI Core Member',
      bio: 'Thành viên ban AI. Đang nghiên cứu RAG và Fine-tuning mô hình ngôn ngữ lớn.',
      skills: ['Python', 'Hugging Face', 'FastAPI', 'Pandas'],
      gems: 150,
      avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150',
    },
    {
      mssv: 'SE180007',
      email: 'member.web@gdgfptu.dev',
      fullName: 'Hoàng Kim Ngân',
      role: Role.MEMBER,
      deptCode: DepartmentType.TECH_WEB,
      position: 'Web Frontend Developer',
      bio: 'Thành viên ban Web. Đam mê giao diện người dùng mượt mà và animation.',
      skills: ['React', 'Zustand', 'CSS Animations', 'UI/UX Design'],
      gems: 180,
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    },
    {
      mssv: 'SE180008',
      email: 'member.hr@gdgfptu.dev',
      fullName: 'Đỗ Tuấn Kiệt',
      role: Role.MEMBER,
      deptCode: DepartmentType.HR_EVENT,
      position: 'Event Coordinator',
      bio: 'Thành viên ban HR-Event. Phụ trách hậu cần và điều phối check-in sự kiện.',
      skills: ['Logistics Management', 'Team Coordination', 'Google Workspace'],
      gems: 120,
      avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
    },
    {
      mssv: 'SE180009',
      email: 'ctv.media@gdgfptu.dev',
      fullName: 'Bùi Yến Nhi',
      role: Role.COLLABORATOR,
      deptCode: DepartmentType.MEDIA,
      position: 'Content Creator (Probation)',
      bio: 'Cộng tác viên ban Truyền thông. Hỗ trợ viết bài fanpage và quay video TikTok.',
      skills: ['Copywriting', 'CapCut', 'Canva'],
      gems: 60,
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    },
  ];

  const userMap = new Map<string, string>(); // email -> userId

  for (const u of usersData) {
    const deptId = deptMap.get(u.deptCode)!;
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        mssv: u.mssv,
        fullName: u.fullName,
        passwordHash,
        gemsBalance: u.gems,
        avatarUrl: u.avatarUrl,
      },
      create: {
        mssv: u.mssv,
        email: u.email,
        fullName: u.fullName,
        passwordHash,
        gemsBalance: u.gems,
        avatarUrl: u.avatarUrl,
        phoneNumber: '0901234567',
        githubUrl: `https://github.com/${u.email.split('@')[0]}`,
        facebookUrl: `https://facebook.com/${u.email.split('@')[0]}`,
        linkedinUrl: `https://linkedin.com/in/${u.email.split('@')[0]}`,
      },
    });

    userMap.set(u.email, user.id);

    // Upsert UserTenure for active tenure
    await prisma.userTenure.upsert({
      where: {
        userId_tenureId: {
          userId: user.id,
          tenureId: activeTenure.id,
        },
      },
      update: {
        departmentId: deptId,
        role: u.role,
        status: u.role === Role.COLLABORATOR ? MemberStatus.PROBATION : MemberStatus.ACTIVE,
        position: u.position,
        bio: u.bio,
        skills: u.skills,
      },
      create: {
        userId: user.id,
        tenureId: activeTenure.id,
        departmentId: deptId,
        role: u.role,
        status: u.role === Role.COLLABORATOR ? MemberStatus.PROBATION : MemberStatus.ACTIVE,
        position: u.position,
        bio: u.bio,
        skills: u.skills,
      },
    });
  }

  // 4. Seed Events & Attendances
  console.log('4️⃣ Seeding Events & Attendances...');
  const workshopEvent = await prisma.event.upsert({
    where: { id: 'evt-ai-workshop-2026' },
    update: {},
    create: {
      id: 'evt-ai-workshop-2026',
      title: 'GenAI & Cloud Codelab: Building Autonomous Agents',
      description: 'Workshop chuyên sâu về xây dựng Multi-Agentic AI systems với Google Vertex AI và LangGraph.',
      type: EventType.WORKSHOP,
      location: 'Hội trường Innovation, Tòa Alpha, ĐH FPT TP.HCM',
      startTime: new Date('2026-10-15T13:30:00.000Z'),
      endTime: new Date('2026-10-15T17:00:00.000Z'),
      attendeeGems: 30,
      organizerGems: 100,
      isPublic: true,
      bannerImageUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800',
      registrationUrl: 'https://gdgfptu.dev/events/genai-codelab',
      tenureId: activeTenure.id,
    },
  });

  const kickOffMeeting = await prisma.event.upsert({
    where: { id: 'evt-kickoff-gen4' },
    update: {},
    create: {
      id: 'evt-kickoff-gen4',
      title: 'Kick-off All-Hands Meeting Gen 4.0',
      description: 'Họp toàn thể thành viên định hướng hoạt động nhiệm kỳ Fall 2026.',
      type: EventType.MEETING,
      location: 'Phòng 204, Tòa Gamma, ĐH FPT TP.HCM',
      startTime: new Date('2026-09-10T18:00:00.000Z'),
      endTime: new Date('2026-09-10T21:00:00.000Z'),
      attendeeGems: 20,
      organizerGems: 50,
      isPublic: false,
      bannerImageUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800',
      tenureId: activeTenure.id,
    },
  });

  // Seed Event Organizers & Attendance
  const hrLeadId = userMap.get('hr.lead@gdgfptu.dev')!;
  const hrMemberId = userMap.get('member.hr@gdgfptu.dev')!;
  const webMemberId = userMap.get('member.web@gdgfptu.dev')!;
  const aiMemberId = userMap.get('member.ai@gdgfptu.dev')!;
  const webLeadId = userMap.get('web.lead@gdgfptu.dev')!;
  const leadId = userMap.get('lead@gdgfptu.dev')!;

  await prisma.eventOrganizer.upsert({
    where: { eventId_userId: { eventId: workshopEvent.id, userId: hrLeadId } },
    update: {},
    create: {
      eventId: workshopEvent.id,
      userId: hrLeadId,
      departmentId: deptMap.get(DepartmentType.HR_EVENT)!,
      roleInEvent: 'Trưởng Ban Tổ Chức',
      isGemsGranted: true,
    },
  });

  await prisma.eventAttendance.upsert({
    where: { eventId_userId: { eventId: kickOffMeeting.id, userId: webMemberId } },
    update: { isVerified: true },
    create: {
      eventId: kickOffMeeting.id,
      userId: webMemberId,
      checkinMethod: CheckinMethod.MANUAL_EVIDENCE,
      isVerified: true,
      verifiedById: hrLeadId,
      notes: 'Có mặt đúng giờ, tham gia tích cực',
    },
  });

  await prisma.eventAttendance.upsert({
    where: { eventId_userId: { eventId: kickOffMeeting.id, userId: aiMemberId } },
    update: { isVerified: false },
    create: {
      eventId: kickOffMeeting.id,
      userId: aiMemberId,
      checkinMethod: CheckinMethod.MANUAL_EVIDENCE,
      isVerified: false,
      notes: 'Chờ HR Lead xác nhận check-in',
    },
  });

  // 5. Seed Kanban Tasks
  console.log('5️⃣ Seeding Kanban Tasks...');
  const tasksData = [
    {
      id: 'task-001',
      title: 'Thiết kế hệ thống DB & API Specification cho GDGoC Portal v1.1',
      description: 'Hoàn thiện schema.prisma v1.1, phân quyền RBAC và API Contracts.',
      status: TaskStatus.DONE,
      priority: TaskPriority.HIGH,
      deadline: new Date('2026-09-20T23:59:59.000Z'),
      gemsReward: 50,
      submissionUrl: 'https://github.com/chinhan142/GDGoC-FPT-Platform/pull/1',
      feedback: 'Thiết kế chuẩn chỉnh, đúng quy chuẩn bảo mật và API response.',
      deptCode: DepartmentType.TECH_WEB,
      creatorEmail: 'lead@gdgfptu.dev',
      assigneeEmail: 'web.lead@gdgfptu.dev',
    },
    {
      id: 'task-002',
      title: 'Tích hợp Frontend API Client Layer & Vite Proxy kết nối Backend thật',
      description: 'Tắt mock MSW, xây dựng các API client auth, members, events, tasks, gems.',
      status: TaskStatus.DONE,
      priority: TaskPriority.URGENT,
      deadline: new Date('2026-09-23T23:59:59.000Z'),
      gemsReward: 40,
      submissionUrl: 'https://github.com/plozdev/gdgoc-fptu-portal/pull/2',
      feedback: 'Tích hợp mượt mà, auth HttpOnly cookie hoạt động tốt.',
      deptCode: DepartmentType.TECH_WEB,
      creatorEmail: 'web.lead@gdgfptu.dev',
      assigneeEmail: 'member.web@gdgfptu.dev',
    },
    {
      id: 'task-003',
      title: 'Chuẩn bị Slide & Codelab Repo cho Workshop GenAI Agentic',
      description: 'Viết Jupyter Notebook hướng dẫn tích hợp Google Gemini API & Function Calling.',
      status: TaskStatus.IN_REVIEW,
      priority: TaskPriority.HIGH,
      deadline: new Date('2026-10-05T23:59:59.000Z'),
      gemsReward: 35,
      submissionUrl: 'https://github.com/gdgoc-fptu/genai-agentic-codelab',
      feedback: null,
      deptCode: DepartmentType.TECH_AI,
      creatorEmail: 'ai.lead@gdgfptu.dev',
      assigneeEmail: 'member.ai@gdgfptu.dev',
    },
    {
      id: 'task-004',
      title: 'Thiết kế bộ Key Visual & Banner truyền thông cho Workshop GenAI',
      description: 'Bộ ấn phẩm bao gồm Banner Facebook 1200x628, Avatar frame, Standee 80x200cm.',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      deadline: new Date('2026-10-01T23:59:59.000Z'),
      gemsReward: 30,
      submissionUrl: null,
      feedback: null,
      deptCode: DepartmentType.MEDIA,
      creatorEmail: 'media.lead@gdgfptu.dev',
      assigneeEmail: 'ctv.media@gdgfptu.dev',
    },
    {
      id: 'task-005',
      title: 'Lập kế hoạch hậu cần & chuẩn bị tea-break cho Workshop',
      description: 'Liên hệ phòng ban FPTU mượn hội trường Innovation, đặt nước và bánh cho 80 người.',
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      deadline: new Date('2026-10-08T23:59:59.000Z'),
      gemsReward: 25,
      submissionUrl: null,
      feedback: null,
      deptCode: DepartmentType.HR_EVENT,
      creatorEmail: 'hr.lead@gdgfptu.dev',
      assigneeEmail: 'member.hr@gdgfptu.dev',
    },
    {
      id: 'task-006',
      title: 'Nghiên cứu tài liệu Google Cloud Career Launchpad & Solution Challenge 2027',
      description: 'Tổng hợp tài liệu hướng dẫn sinh viên tham gia Google Solution Challenge 2027.',
      status: TaskStatus.BACKLOG,
      priority: TaskPriority.LOW,
      deadline: new Date('2026-11-01T23:59:59.000Z'),
      gemsReward: 20,
      submissionUrl: null,
      feedback: null,
      deptCode: DepartmentType.TECH_RESEARCH,
      creatorEmail: 'lead@gdgfptu.dev',
      assigneeEmail: 'member.ai@gdgfptu.dev',
    },
  ];

  for (const t of tasksData) {
    const creatorId = userMap.get(t.creatorEmail)!;
    const assigneeId = userMap.get(t.assigneeEmail)!;
    const deptId = deptMap.get(t.deptCode)!;

    const task = await prisma.task.upsert({
      where: { id: t.id },
      update: {
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        deadline: t.deadline,
        gemsReward: t.gemsReward,
        submissionUrl: t.submissionUrl,
        feedback: t.feedback,
      },
      create: {
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        deadline: t.deadline,
        gemsReward: t.gemsReward,
        submissionUrl: t.submissionUrl,
        feedback: t.feedback,
        tenureId: activeTenure.id,
        departmentId: deptId,
        creatorId: creatorId,
      },
    });

    await prisma.taskAssignee.upsert({
      where: { taskId_userId: { taskId: task.id, userId: assigneeId } },
      update: {},
      create: {
        taskId: task.id,
        userId: assigneeId,
      },
    });
  }

  // 6. Seed Gifts & Redemptions
  console.log('6️⃣ Seeding Gift Items & Redemptions...');
  const giftsData = [
    {
      id: 'gift-01',
      name: 'Áo thun GDGoC FPTU Premium Tee (Cotton 100%)',
      description: 'Áo thun đồng phục GDGoC chất liệu cotton 2 chiều cao cấp, logo thêu tinh xảo.',
      gemsPrice: 120,
      stock: 35,
      imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=400',
    },
    {
      id: 'gift-02',
      name: 'Bình giữ nhiệt Google Developer 500ml',
      description: 'Bình giữ nhiệt inox 304 giữ nhiệt 12h, nắp hiển thị nhiệt độ cảm ứng LED.',
      gemsPrice: 180,
      stock: 20,
      imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400',
    },
    {
      id: 'gift-03',
      name: 'Bộ Sticker Hologram Google Tech Stack (15 pcs)',
      description: 'Bộ 15 sticker hologram chống nước chủ đề Flutter, Firebase, TensorFlow, Gemini, Go.',
      gemsPrice: 30,
      stock: 100,
      imageUrl: 'https://images.unsplash.com/photo-1572375992501-4b0892d50c69?w=400',
    },
    {
      id: 'gift-04',
      name: 'Balo Laptop Chống Nước GDG Developer Backpack',
      description: 'Balo đựng laptop 15.6 inch chống thấm nước, nhiều ngăn tiện lợi cho dev.',
      gemsPrice: 350,
      stock: 8,
      imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400',
    },
  ];

  for (const g of giftsData) {
    await prisma.giftItem.upsert({
      where: { id: g.id },
      update: {
        name: g.name,
        description: g.description,
        gemsPrice: g.gemsPrice,
        stock: g.stock,
        imageUrl: g.imageUrl,
        isActive: true,
      },
      create: {
        id: g.id,
        name: g.name,
        description: g.description,
        gemsPrice: g.gemsPrice,
        stock: g.stock,
        imageUrl: g.imageUrl,
        isActive: true,
      },
    });
  }

  // Seed sample redemption
  await prisma.giftRedemption.upsert({
    where: { id: 'redemption-001' },
    update: {},
    create: {
      id: 'redemption-001',
      userId: webMemberId,
      giftItemId: 'gift-01',
      gemsSpent: 120,
      status: RedemptionStatus.PENDING,
      notes: 'Đổi áo size L, nhận tại phòng Lab Web',
    },
  });

  // 7. Seed Gems Transactions
  console.log('7️⃣ Seeding Gems Transactions...');
  const transactionsData = [
    {
      userId: webMemberId,
      amount: 50,
      type: GemsTransactionType.TASK_REWARD,
      referenceId: 'task-001',
      reason: 'Thưởng hoàn thành xuất sắc task: Kiến trúc DB & API v1.1',
      idempotencyKey: 'tx-task-reward-001',
    },
    {
      userId: webMemberId,
      amount: 20,
      type: GemsTransactionType.EVENT_ATTENDANCE,
      referenceId: 'evt-kickoff-gen4',
      reason: 'Điểm danh Kick-off All-Hands Meeting Gen 4.0',
      idempotencyKey: 'tx-evt-attend-kickoff-webmember',
    },
    {
      userId: webMemberId,
      amount: -120,
      type: GemsTransactionType.GIFT_REDEMPTION,
      referenceId: 'redemption-001',
      reason: 'Đổi quà: Áo thun GDGoC FPTU Premium Tee',
      idempotencyKey: 'tx-gift-redeem-001',
    },
    {
      userId: aiMemberId,
      amount: 50,
      type: GemsTransactionType.MANUAL_ADJUSTMENT,
      reason: 'Khen thưởng giải Nhì Hackathon Google Cloud Challenge',
      idempotencyKey: 'tx-reward-ai-hackathon',
    },
  ];

  for (const tx of transactionsData) {
    await prisma.gemsTransaction.upsert({
      where: { idempotencyKey: tx.idempotencyKey },
      update: {},
      create: {
        userId: tx.userId,
        amount: tx.amount,
        type: tx.type,
        referenceId: tx.referenceId,
        reason: tx.reason,
        idempotencyKey: tx.idempotencyKey,
      },
    });
  }

  // 8. Seed Inventory Items
  console.log('8️⃣ Seeding Inventory Items...');
  const inventoryData = [
    {
      id: 'inv-001',
      name: 'Standee chữ X GDGoC FPTU (0.8m x 1.8m)',
      category: 'Asset',
      quantity: 4,
      holderName: 'Lưu tại Tủ đồ CLB (Phòng 201 Tòa Alpha)',
      notes: 'Bao gồm 4 khung sắt + 4 bạt in',
    },
    {
      id: 'inv-002',
      name: 'Bộ Micro không dây Shure cầm tay (2 tay mic)',
      category: 'Asset',
      quantity: 2,
      holderName: 'Nguyễn Thảo Vy (HR Lead)',
      holderUserId: hrLeadId,
      notes: 'Kèm đầu thu và pin sạc',
    },
    {
      id: 'inv-003',
      name: 'Loa kéo di động Bluetooth 400W',
      category: 'Asset',
      quantity: 1,
      holderName: 'Lưu tại Tủ đồ CLB',
      notes: 'Dùng cho các buổi teambuilding và workshop',
    },
    {
      id: 'inv-004',
      name: 'Áo thun đồng phục GDGoC FPTU lưu kho',
      category: 'Gift',
      quantity: 35,
      holderName: 'Lưu tại Kho Quà tặng CLB',
      notes: 'Size S: 10, Size M: 15, Size L: 10',
    },
    {
      id: 'inv-005',
      name: 'Cuộn Dây đeo thẻ GDGoC (Lanyards)',
      category: 'Consumable',
      quantity: 120,
      holderName: 'Lưu tại Tủ đồ CLB',
      notes: 'Phát cho người tham gia workshop',
    },
  ];

  for (const inv of inventoryData) {
    await prisma.inventoryItem.upsert({
      where: { id: inv.id },
      update: {
        name: inv.name,
        category: inv.category,
        quantity: inv.quantity,
        holderName: inv.holderName,
        holderUserId: inv.holderUserId,
        notes: inv.notes,
      },
      create: {
        id: inv.id,
        name: inv.name,
        category: inv.category,
        quantity: inv.quantity,
        holderName: inv.holderName,
        holderUserId: inv.holderUserId,
        notes: inv.notes,
      },
    });
  }

  // 9. Seed Notifications
  console.log('9️⃣ Seeding Notifications...');
  const notifsData = [
    {
      id: 'notif-001',
      title: 'Chào mừng nhiệm kỳ Fall 2026 - Gen 4.0!',
      message: 'Chúc mừng toàn thể thành viên GDGoC FPTU HCMC bước vào nhiệm kỳ mới đầy nhiệt huyết và bứt phá!',
      type: NotificationType.BROADCAST,
      priority: NotificationPriority.IMPORTANT,
      targetDepartmentId: null, // Broadcast all
      senderId: leadId,
      link: '/app/dashboard',
    },
    {
      id: 'notif-002',
      title: 'Đăng ký tham gia Workshop GenAI & Cloud Codelab',
      message: 'Các thành viên ban Tech đăng ký tham gia hỗ trợ kỹ thuật trước ngày 10/10.',
      type: NotificationType.EVENT,
      priority: NotificationPriority.NORMAL,
      targetDepartmentId: deptMap.get(DepartmentType.TECH_AI)!,
      senderId: userMap.get('ai.lead@gdgfptu.dev')!,
      link: '/app/events',
    },
    {
      id: 'notif-003',
      title: 'Giao task: Tích hợp Frontend API Client Layer',
      message: 'Task của bạn đã được tạo và phân công trong Kanban Board.',
      type: NotificationType.TASK,
      priority: NotificationPriority.URGENT,
      targetDepartmentId: deptMap.get(DepartmentType.TECH_WEB)!,
      senderId: webLeadId,
      link: '/app/tasks',
    },
    {
      id: 'notif-004',
      title: 'Bạn vừa nhận được +50 Gems thưởng task!',
      message: 'Lead đã duyệt hoàn thành task Kiến trúc DB & API v1.1. Gems đã được cộng vào tài khoản.',
      type: NotificationType.GEMS,
      priority: NotificationPriority.NORMAL,
      targetDepartmentId: null,
      senderId: leadId,
      link: '/app/gems',
    },
  ];

  for (const n of notifsData) {
    const notif = await prisma.notification.upsert({
      where: { id: n.id },
      update: {
        title: n.title,
        message: n.message,
        type: n.type,
        priority: n.priority,
        targetDepartmentId: n.targetDepartmentId,
        link: n.link,
      },
      create: {
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        priority: n.priority,
        targetDepartmentId: n.targetDepartmentId,
        link: n.link,
        senderId: n.senderId,
      },
    });

    // Mark as read for webLead
    await prisma.notificationRead.upsert({
      where: {
        notificationId_userId: {
          notificationId: notif.id,
          userId: webLeadId,
        },
      },
      update: {},
      create: {
        notificationId: notif.id,
        userId: webLeadId,
      },
    });
  }

  // 10. Seed Drive Assets
  console.log('🔟 Seeding Drive Assets...');
  const driveAssetsData = [
    {
      id: 'drive-001',
      name: 'Bộ Nhận Diện Thương Hiệu GDGoC FPTU Gen 4.0 (Brand Guidelines)',
      description: 'Logo vector, bảng màu chuẩn Google Developer, font chữ Product Sans, mockup slide.',
      category: DriveCategory.BRAND_KIT,
      driveUrl: 'https://drive.google.com/drive/folders/1AfhY62LqPx1t4POy8Hn7h9Y-tIS8Ccc0',
      driveFileId: '1AfhY62LqPx1t4POy8Hn7h9Y-tIS8Ccc0',
      accessLevel: AccessLevel.PUBLIC,
      tenureId: activeTenure.id,
    },
    {
      id: 'drive-002',
      name: 'Kho Tài Liệu Kỹ Thuật: Agentic AI & Vertex AI Codelabs',
      description: 'Tập hợp source code, Jupyter Notebooks, tài liệu training ban Tech AI.',
      category: DriveCategory.TECH_LIBRARY,
      driveUrl: 'https://drive.google.com/drive/folders/1TechLibraryFolderId',
      driveFileId: '1TechLibraryFolderId',
      accessLevel: AccessLevel.INTERNAL_MEMBER,
      tenureId: activeTenure.id,
      departmentId: deptMap.get(DepartmentType.TECH_AI)!,
    },
    {
      id: 'drive-003',
      name: 'Kho Ảnh Sự Kiện: Kick-off All-Hands Gen 4.0 (HD Photos)',
      description: 'Bộ ảnh full độ phân giải buổi họp mặt đầu nhiệm kỳ.',
      category: DriveCategory.MEDIA_VAULT,
      driveUrl: 'https://drive.google.com/drive/folders/1MediaVaultFolderId',
      driveFileId: '1MediaVaultFolderId',
      accessLevel: AccessLevel.INTERNAL_MEMBER,
      tenureId: activeTenure.id,
      eventId: kickOffMeeting.id,
    },
    {
      id: 'drive-004',
      name: 'Báo Cáo Tài Chính & Thu Chi Nhiệm Kỳ Fall 2026',
      description: 'Bảng theo dõi thu chi ngân sách tài trợ và hoạt động CLB.',
      category: DriveCategory.FINANCE,
      driveUrl: 'https://drive.google.com/drive/folders/1FinanceFolderId',
      driveFileId: '1FinanceFolderId',
      accessLevel: AccessLevel.EXECUTIVE_ONLY,
      tenureId: activeTenure.id,
    },
  ];

  for (const d of driveAssetsData) {
    await prisma.driveAsset.upsert({
      where: { id: d.id },
      update: {
        name: d.name,
        description: d.description,
        category: d.category,
        driveUrl: d.driveUrl,
        driveFileId: d.driveFileId,
        accessLevel: d.accessLevel,
      },
      create: {
        id: d.id,
        name: d.name,
        description: d.description,
        category: d.category,
        driveUrl: d.driveUrl,
        driveFileId: d.driveFileId,
        accessLevel: d.accessLevel,
        tenureId: d.tenureId,
        departmentId: d.departmentId,
        eventId: d.eventId,
      },
    });
  }

  console.log('\n🎉 =======================================================');
  console.log('✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!');
  console.log('=======================================================');
  console.log('🔑 TEST ACCOUNTS (MẬT KHẨU CHUNG: GDGoC@2026):');
  console.log('-------------------------------------------------------');
  console.log('1. Chapter Lead (LEAD - BCN)      : lead@gdgfptu.dev     | MSSV: SE180001');
  console.log('2. Advisor (ADVISOR - Cố vấn)     : advisor@gdgfptu.dev  | MSSV: AD100001');
  console.log('3. Web Lead (DEPT_LEAD - Web)     : web.lead@gdgfptu.dev | MSSV: SE180003');
  console.log('4. AI Lead (DEPT_LEAD - AI)       : ai.lead@gdgfptu.dev  | MSSV: SE180002');
  console.log('5. HR Lead (DEPT_LEAD - HR/Event) : hr.lead@gdgfptu.dev  | MSSV: SE180004');
  console.log('6. Media Lead (DEPT_LEAD - Media) : media.lead@gdgfptu.dev| MSSV: SE180005');
  console.log('7. Web Member (MEMBER - Web)      : member.web@gdgfptu.dev| MSSV: SE180007');
  console.log('8. AI Member (MEMBER - AI)        : member.ai@gdgfptu.dev | MSSV: SE180006');
  console.log('9. HR Member (MEMBER - HR)        : member.hr@gdgfptu.dev | MSSV: SE180008');
  console.log('10. CTV Media (COLLABORATOR)      : ctv.media@gdgfptu.dev | MSSV: SE180009');
  console.log('=======================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
