import 'dotenv/config';
import {
  PrismaClient,
  DepartmentType,
  Role,
  MemberStatus,
  TaskStatus,
  TaskPriority,
  EventType,
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

function parseDateVN(dateStr?: string): Date {
  if (!dateStr || !dateStr.trim()) return new Date('2024-01-01T00:00:00.000Z');
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(Date.UTC(year, month, day));
  }
  return new Date('2024-01-01T00:00:00.000Z');
}

const csvMembers = [
  {
    fullName: 'Nguyễn Tiến Minh',
    academicYear: 'K21',
    mssv: 'SE212192',
    email: 'nguyentienminh1492007@gmail.com',
    phoneNumber: '0855231427',
    position: 'AI',
    gen: 'GEN 2.1',
    status: MemberStatus.ACTIVE,
    joinedDate: '20/09/2025',
    deptCode: DepartmentType.TECH_AI,
    role: Role.MEMBER,
  },
  {
    fullName: 'Dovgal Boris',
    academicYear: 'K21',
    mssv: 'SE211132',
    email: 'dovgalboris14052005@gmail.com',
    phoneNumber: '0905024638',
    position: 'AI',
    gen: 'GEN 3.0',
    status: MemberStatus.ACTIVE,
    joinedDate: '08/01/2026',
    deptCode: DepartmentType.TECH_AI,
    role: Role.MEMBER,
  },
  {
    fullName: 'Võ Cao Minh',
    academicYear: 'K20',
    mssv: 'SE203168',
    email: 'vocaominh7406@gmail.com',
    phoneNumber: '0983523734',
    position: 'AI Lead',
    gen: 'GEN 2.1',
    status: MemberStatus.ACTIVE,
    joinedDate: '20/09/2025',
    deptCode: DepartmentType.TECH_AI,
    role: Role.DEPARTMENT_LEAD,
  },
  {
    fullName: 'Lê Tiến Đạt',
    academicYear: 'K18',
    mssv: 'SE182453',
    email: 'datletien1352004@gmail.com',
    phoneNumber: '0908482601',
    position: 'Alumni',
    gen: 'GEN 1.0',
    status: MemberStatus.ALUMNI,
    joinedDate: '',
    deptCode: DepartmentType.EXECUTIVE,
    role: Role.MEMBER,
  },
  {
    fullName: 'Nguyễn Đức Tuấn',
    academicYear: 'K17',
    mssv: 'SE173318',
    email: 'tuanndse173318@fpt.edu.vn',
    phoneNumber: '0387050243',
    position: 'Alumni',
    gen: 'GEN 1.0',
    status: MemberStatus.ALUMNI,
    joinedDate: '',
    deptCode: DepartmentType.EXECUTIVE,
    role: Role.MEMBER,
  },
  {
    fullName: 'Nguyễn Minh Triết',
    academicYear: 'K19',
    mssv: 'SE194257',
    email: 'minhtriet.gect@gmail.com',
    phoneNumber: '0981908680',
    position: 'Alumni',
    gen: 'GEN 1.0',
    status: MemberStatus.ALUMNI,
    joinedDate: '',
    deptCode: DepartmentType.EXECUTIVE,
    role: Role.MEMBER,
  },
  {
    fullName: 'Nguyễn Thị Huỳnh Như',
    academicYear: 'K18',
    mssv: 'SE180751',
    email: 'nhunthss180751@fpt.edu.vn',
    phoneNumber: '0362740540',
    position: 'Alumni',
    gen: 'GEN 1.0',
    status: MemberStatus.ALUMNI,
    joinedDate: '',
    deptCode: DepartmentType.EXECUTIVE,
    role: Role.MEMBER,
  },
  {
    fullName: 'Trần Quốc Cường',
    academicYear: 'K18',
    mssv: 'SE182989',
    email: 'se182989@fpt.edu.vn',
    phoneNumber: '0867016729',
    position: 'Alumni',
    gen: 'GEN 1.0',
    status: MemberStatus.ALUMNI,
    joinedDate: '',
    deptCode: DepartmentType.EXECUTIVE,
    role: Role.MEMBER,
  },
  {
    fullName: 'Mai Nguyễn Duy Khánh',
    academicYear: 'K19',
    mssv: 'SE196605',
    email: 'mndkhanh@gmail.com',
    phoneNumber: '0362718422',
    position: 'Alumni',
    gen: 'GEN 2.0',
    status: MemberStatus.ALUMNI,
    joinedDate: '12/11/2024',
    deptCode: DepartmentType.EXECUTIVE,
    role: Role.MEMBER,
  },
  {
    fullName: 'Lê Thành Đạt',
    academicYear: 'K16',
    mssv: 'SE161707',
    email: 'datlt.mdc@gmail.com',
    phoneNumber: '0868479485',
    position: 'Alumni',
    gen: 'GEN 2.1',
    status: MemberStatus.ALUMNI,
    joinedDate: '20/09/2025',
    deptCode: DepartmentType.EXECUTIVE,
    role: Role.MEMBER,
  },
  {
    fullName: 'Nguyễn Dương Thiên Ý',
    academicYear: 'K20',
    mssv: 'SE203183',
    email: 'nguyenyk6@gmail.com',
    phoneNumber: '0378347402',
    position: 'Alumni',
    gen: 'GEN 2.1',
    status: MemberStatus.ALUMNI,
    joinedDate: '20/09/2025',
    deptCode: DepartmentType.EXECUTIVE,
    role: Role.MEMBER,
  },
  {
    fullName: 'Mai Xuân Hiếu',
    academicYear: 'K20',
    mssv: 'SE200972',
    email: 'xuanhieubato@gmail.com',
    phoneNumber: '0965607840',
    position: 'Alumni',
    gen: 'GEN 3.0',
    status: MemberStatus.ALUMNI,
    joinedDate: '08/01/2026',
    deptCode: DepartmentType.EXECUTIVE,
    role: Role.MEMBER,
  },
  {
    fullName: 'Trần Ái Quốc',
    academicYear: 'K19',
    mssv: 'SE196571',
    email: 'quoctran.010705@gmail.com',
    phoneNumber: '0975469145',
    position: 'Alumni',
    gen: 'GEN 3.0',
    status: MemberStatus.ALUMNI,
    joinedDate: '08/01/2026',
    deptCode: DepartmentType.EXECUTIVE,
    role: Role.MEMBER,
  },
  {
    fullName: 'Trần Võ Minh Hùng',
    academicYear: 'K20',
    mssv: 'SE204891',
    email: 'hungminh.2310@gmail.com',
    phoneNumber: '0396608440',
    position: 'Chapter Lead + Research',
    gen: 'GEN 2.0',
    status: MemberStatus.ACTIVE,
    joinedDate: '12/11/2024',
    deptCode: DepartmentType.EXECUTIVE,
    role: Role.LEAD,
  },
  {
    fullName: 'Huỳnh Tấn Thắng',
    academicYear: 'K20',
    mssv: 'SE200096',
    email: 'darkegame101@gmail.com',
    phoneNumber: '0353344248',
    position: 'Cloud',
    gen: 'GEN 2.0',
    status: MemberStatus.ACTIVE,
    joinedDate: '12/11/2024',
    deptCode: DepartmentType.TECH_CLOUD,
    role: Role.MEMBER,
  },
  {
    fullName: 'Nguyễn Lê Anh Tú',
    academicYear: 'K20',
    mssv: 'SE203283',
    email: 'nguyentujkl123@gmail.com',
    phoneNumber: '0904115133',
    position: 'Cloud',
    gen: 'GEN 2.0',
    status: MemberStatus.ACTIVE,
    joinedDate: '12/11/2024',
    deptCode: DepartmentType.TECH_CLOUD,
    role: Role.MEMBER,
  },
  {
    fullName: 'Hoàng Đức Hiếu',
    academicYear: 'K21',
    mssv: 'SE211976',
    email: 'concacon117@gmail.com',
    phoneNumber: '0779042297',
    position: 'Cloud',
    gen: 'GEN 3.0',
    status: MemberStatus.ACTIVE,
    joinedDate: '08/01/2026',
    deptCode: DepartmentType.TECH_CLOUD,
    role: Role.MEMBER,
  },
  {
    fullName: 'Võ Trần Ngọc Hữu',
    academicYear: 'K19',
    mssv: 'SE196276',
    email: 'votranngochuu@gmail.com',
    phoneNumber: '0348904132',
    position: 'Cloud Lead',
    gen: 'GEN 3.0',
    status: MemberStatus.ACTIVE,
    joinedDate: '08/01/2026',
    deptCode: DepartmentType.TECH_CLOUD,
    role: Role.DEPARTMENT_LEAD,
  },
  {
    fullName: 'Trần Vũ Hoàng Long',
    academicYear: 'K20',
    mssv: 'SE204861',
    email: 'tranvuhoanglong12@gmail.com',
    phoneNumber: '0814859039',
    position: 'Co-Chapter Lead',
    gen: 'GEN 2.0',
    status: MemberStatus.ACTIVE,
    joinedDate: '12/11/2024',
    deptCode: DepartmentType.EXECUTIVE,
    role: Role.LEAD,
  },
  {
    fullName: 'Trần Minh Khang',
    academicYear: 'K20',
    mssv: 'SE203117',
    email: 'minhkhang.fptu@gmail.com',
    phoneNumber: '0974164014',
    position: 'Co-Chapter Lead + Cloud',
    gen: 'GEN 2.0',
    status: MemberStatus.ACTIVE,
    joinedDate: '12/11/2024',
    deptCode: DepartmentType.EXECUTIVE,
    role: Role.LEAD,
  },
  {
    fullName: 'Mai Anh Hoàng',
    academicYear: 'K20',
    mssv: 'SE200043',
    email: 'hoangmai.it.dev@gmail.com',
    phoneNumber: '0348246440',
    position: 'Event Lead',
    gen: 'GEN 2.0',
    status: MemberStatus.ACTIVE,
    joinedDate: '12/11/2024',
    deptCode: DepartmentType.HR_EVENT,
    role: Role.DEPARTMENT_LEAD,
  },
  {
    fullName: 'Trần Minh Tuấn',
    academicYear: 'K19',
    mssv: 'SE193576',
    email: 'kethaman1998@gmail.com',
    phoneNumber: '0963198339',
    position: 'Media + Cloud',
    gen: 'GEN 3.0',
    status: MemberStatus.ACTIVE,
    joinedDate: '08/01/2026',
    deptCode: DepartmentType.MEDIA,
    role: Role.MEMBER,
  },
  {
    fullName: 'Hồ Ngọc Bảo Trân',
    academicYear: 'K20',
    mssv: 'SE204181',
    email: 'hngbtran@gmail.com',
    phoneNumber: '0902044300',
    position: 'Media Lead',
    gen: 'GEN 2.0',
    status: MemberStatus.ACTIVE,
    joinedDate: '12/11/2024',
    deptCode: DepartmentType.MEDIA,
    role: Role.DEPARTMENT_LEAD,
  },
  {
    fullName: 'Nguyễn Quốc Duy',
    academicYear: 'K20',
    mssv: 'SE203196',
    email: 'qduy29102006@gmail.com',
    phoneNumber: '0984941264',
    position: 'Research',
    gen: 'GEN 2.0',
    status: MemberStatus.ACTIVE,
    joinedDate: '12/11/2024',
    deptCode: DepartmentType.TECH_RESEARCH,
    role: Role.MEMBER,
  },
  {
    fullName: 'Dương Vũ Thái An',
    academicYear: 'K19',
    mssv: 'SE194622',
    email: 'duongvuthaian@gmail.com',
    phoneNumber: '0886127549',
    position: 'Research',
    gen: 'GEN 3.0',
    status: MemberStatus.ACTIVE,
    joinedDate: '08/01/2026',
    deptCode: DepartmentType.TECH_RESEARCH,
    role: Role.MEMBER,
  },
  {
    fullName: 'Bùi Anh Huy',
    academicYear: 'K20',
    mssv: 'SE201491',
    email: 'anhhuybui2006@gmail.com',
    phoneNumber: '0919670931',
    position: 'Research Lead',
    gen: 'GEN 3.0',
    status: MemberStatus.ACTIVE,
    joinedDate: '08/01/2026',
    deptCode: DepartmentType.TECH_RESEARCH,
    role: Role.DEPARTMENT_LEAD,
  },
  {
    fullName: 'Chiêm Minh Thức',
    academicYear: 'K20',
    mssv: 'SE204605',
    email: 'minhthuctim13@gmail.com',
    phoneNumber: '0933658779',
    position: 'Web',
    gen: 'GEN 2.1',
    status: MemberStatus.ACTIVE,
    joinedDate: '20/09/2025',
    deptCode: DepartmentType.TECH_WEB,
    role: Role.MEMBER,
  },
  {
    fullName: 'Đặng Huỳnh Tấn Lộc',
    academicYear: 'K21',
    mssv: 'SE211278',
    email: 'mikeydang735@gmail.com',
    phoneNumber: '0902342406',
    position: 'Web',
    gen: 'GEN 2.1',
    status: MemberStatus.ACTIVE,
    joinedDate: '20/09/2025',
    deptCode: DepartmentType.TECH_WEB,
    role: Role.MEMBER,
  },
  {
    fullName: 'Đào Hoàng Nhật',
    academicYear: 'K20',
    mssv: 'SE201017',
    email: 'daonhat082@gmail.com',
    phoneNumber: '0974781860',
    position: 'Web',
    gen: 'GEN 2.1',
    status: MemberStatus.ACTIVE,
    joinedDate: '20/09/2025',
    deptCode: DepartmentType.TECH_WEB,
    role: Role.MEMBER,
  },
  {
    fullName: 'Lê Khắc Minh Quang',
    academicYear: 'K20',
    mssv: 'SE204789',
    email: 'quang221208642@gmail.com',
    phoneNumber: '0974920299',
    position: 'Web',
    gen: 'GEN 2.1',
    status: MemberStatus.ACTIVE,
    joinedDate: '20/09/2025',
    deptCode: DepartmentType.TECH_WEB,
    role: Role.MEMBER,
  },
  {
    fullName: 'Trần Viết Trà Lâm',
    academicYear: 'K18',
    mssv: 'SE182432',
    email: 'lamtranmonkey@gmail.com',
    phoneNumber: '0908948249',
    position: 'Web',
    gen: 'GEN 3.0',
    status: MemberStatus.ACTIVE,
    joinedDate: '08/01/2026',
    deptCode: DepartmentType.TECH_WEB,
    role: Role.MEMBER,
  },
  {
    fullName: 'Bùi Phạm Chí Nhân',
    academicYear: 'K20',
    mssv: 'SE203237',
    email: 'buiphamchinhan@gmail.com',
    phoneNumber: '0394654576',
    position: 'Web Lead',
    gen: 'GEN 2.0',
    status: MemberStatus.ACTIVE,
    joinedDate: '12/11/2024',
    deptCode: DepartmentType.TECH_WEB,
    role: Role.DEPARTMENT_LEAD,
  },
];

async function main() {
  console.log('--- Kiểm tra dữ liệu hệ thống GDGoC-OS ---');

  // Kiểm tra nếu database đã có người dùng thì không xóa để bảo toàn dữ liệu nhất quán
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log(`ℹ️ Database đã có ${userCount} người dùng. Bỏ qua nạp dữ liệu mẫu để bảo toàn dữ liệu chỉnh sửa của quản trị viên.`);
    return;
  }

  // 1. Dọn dẹp dữ liệu cũ (chỉ chạy khi database trống)
  console.log('1. Khởi tạo dữ liệu người dùng ban đầu...');
  await prisma.notification.deleteMany();
  await prisma.giftRedemption.deleteMany();
  await prisma.gemsTransaction.deleteMany();
  await prisma.eventAttendance.deleteMany();
  await prisma.eventOrganizer.deleteMany();
  await prisma.taskAssignee.deleteMany();
  await prisma.task.deleteMany();
  await prisma.userTenure.deleteMany();
  await prisma.user.deleteMany();
  console.log('   ✓ Đã sẵn sàng nạp dữ liệu khởi tạo!');

  // 2. Khởi tạo 7 Ban
  console.log('2. Đồng bộ 7 Ban chuyên môn...');
  const departments = [
    { code: DepartmentType.EXECUTIVE, name: 'Ban Chủ Nhiệm', nameEn: 'Executive Board' },
    { code: DepartmentType.TECH_AI, name: 'Ban Trí Tuệ Nhân Tạo', nameEn: 'AI Engineering' },
    { code: DepartmentType.TECH_CLOUD, name: 'Ban Điện Toán Đám Mây', nameEn: 'Cloud Engineering' },
    { code: DepartmentType.TECH_WEB, name: 'Ban Phát Triển Web', nameEn: 'Web Development' },
    { code: DepartmentType.TECH_RESEARCH, name: 'Ban Nghiên Cứu & Học Thuật', nameEn: 'Research & Academics' },
    { code: DepartmentType.MEDIA, name: 'Ban Truyền Thông & Thiết Kế', nameEn: 'Media & Design' },
    { code: DepartmentType.HR_EVENT, name: 'Ban Nhân Sự & Tổ Chức Sự Kiện', nameEn: 'HR & Event Operations' },
  ];

  const deptMap = new Map<DepartmentType, string>();
  for (const dept of departments) {
    const upserted = await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name, nameEn: dept.nameEn },
      create: {
        code: dept.code,
        name: dept.name,
        nameEn: dept.nameEn,
      },
    });
    deptMap.set(dept.code, upserted.id);
  }
  console.log('   ✓ Đã đồng bộ 7 Ban');

  // 3. Khởi tạo hoặc cập nhật Active Tenure
  console.log('3. Khởi tạo Niên Khóa hoạt động...');
  let activeTenure = await prisma.tenure.findFirst({
    where: { isFrozen: false },
  });

  if (!activeTenure) {
    activeTenure = await prisma.tenure.create({
      data: {
        name: 'Fall 2026',
        genLabel: 'Gen 4.0',
        chapterLead: 'Trần Võ Minh Hùng',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        endDate: new Date('2027-01-31T23:59:59.000Z'),
        isFrozen: false,
        isArchived: false,
      },
    });
    console.log(`   ✓ Tạo mới nhiệm kỳ: ${activeTenure.name} (${activeTenure.genLabel})`);
  } else {
    activeTenure = await prisma.tenure.update({
      where: { id: activeTenure.id },
      data: {
        chapterLead: 'Trần Võ Minh Hùng',
      },
    });
    console.log(`   ✓ Cập nhật nhiệm kỳ hiện tại: ${activeTenure.name} (${activeTenure.genLabel})`);
  }

  // 4. Mã hóa mật khẩu chung: Password123@
  const defaultPassword = 'Password123@';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // 5. Nạp tài khoản quản trị dự phòng (Lead Admin)
  const execDeptId = deptMap.get(DepartmentType.EXECUTIVE)!;
  await prisma.user.create({
    data: {
      email: 'lead@fpt.edu.vn',
      mssv: 'SE170001',
      fullName: 'Quản Trị Viên (Chapter Lead Admin)',
      passwordHash,
      gemsBalance: 999,
      tenures: {
        create: {
          tenureId: activeTenure.id,
          departmentId: execDeptId,
          role: Role.LEAD,
          status: MemberStatus.ACTIVE,
          position: 'Chapter Lead Admin',
          skills: ['GEN 4.0', 'K17', 'Admin'],
          bio: 'Tài khoản Quản Trị Hệ Thống GDGoC-OS',
        },
      },
    },
  });
  console.log(`   ✓ Đã tạo tài khoản Admin dự phòng: lead@fpt.edu.vn - Password: ${defaultPassword}`);

  // 6. Nạp danh sách 32 thành viên từ file
  console.log(`4. Đang nạp ${csvMembers.length} thành viên từ danh sách...`);
  for (const m of csvMembers) {
    const deptId = deptMap.get(m.deptCode);
    if (!deptId) {
      console.warn(`   ⚠️ Không tìm thấy phòng ban cho: ${m.fullName}`);
      continue;
    }

    const joinedAt = parseDateVN(m.joinedDate);

    await prisma.user.create({
      data: {
        email: m.email.toLowerCase().trim(),
        mssv: m.mssv.toUpperCase().trim(),
        fullName: m.fullName.trim(),
        phoneNumber: m.phoneNumber.trim(),
        passwordHash,
        gemsBalance: 100,
        tenures: {
          create: {
            tenureId: activeTenure.id,
            departmentId: deptId,
            role: m.role,
            status: m.status,
            position: m.position.trim(),
            skills: [m.gen, m.academicYear],
            bio: `${m.fullName} - ${m.position.trim()} (${m.gen})`,
            joinedAt,
          },
        },
      },
    });
    console.log(`   + [${m.academicYear}] ${m.mssv} - ${m.fullName} (${m.position.trim()} - ${m.gen})`);
  }

  console.log('✅ Hoàn tất nạp toàn bộ 32 thành viên thành công!');

  // 7. Nạp Sự Kiện mẫu
  console.log('5. Đang nạp các sự kiện mẫu kỳ Fall 2026...');
  const sampleEvents = [
    {
      title: 'Google I/O Extended FPTU HCMC 2026',
      description: 'Sự kiện công nghệ thường niên lớn nhất của GDGoC FPTU HCMC cập nhật công nghệ mới nhất từ Google.',
      type: EventType.FLAGSHIP,
      location: 'Hội trường Edison, ĐH FPT TP.HCM',
      startTime: new Date('2026-10-15T08:30:00Z'),
      endTime: new Date('2026-10-15T12:00:00Z'),
      attendeeGems: 50,
      organizerGems: 100,
      isPublic: true,
      tenureId: activeTenure.id,
    },
    {
      title: 'Gemini AI & Vertex AI Hands-on Workshop',
      description: 'Thực hành xây dựng ứng dụng với Gemini 1.5 Pro và Vertex AI trên Google Cloud.',
      type: EventType.WORKSHOP,
      location: 'Phòng Lab Innovation, ĐH FPT TP.HCM',
      startTime: new Date('2026-10-25T13:30:00Z'),
      endTime: new Date('2026-10-25T17:00:00Z'),
      attendeeGems: 30,
      organizerGems: 60,
      isPublic: true,
      tenureId: activeTenure.id,
    },
    {
      title: 'Google Solution Challenge 2027 Kick-off',
      description: 'Khởi động cuộc thi Solution Challenge 2027 giải quyết 17 mục tiêu phát triển bền vững của Liên Hợp Quốc.',
      type: EventType.CAMPUS_CHALLENGE,
      location: 'Hội trường Innovation Hall, ĐH FPT TP.HCM',
      startTime: new Date('2026-11-10T09:00:00Z'),
      endTime: new Date('2026-11-10T11:30:00Z'),
      attendeeGems: 40,
      organizerGems: 80,
      isPublic: true,
      tenureId: activeTenure.id,
    },
  ];

  for (const ev of sampleEvents) {
    await prisma.event.create({ data: ev });
  }
  console.log(`   ✓ Đã tạo ${sampleEvents.length} sự kiện trọng điểm`);

  // 8. Nạp Nhiệm vụ (Tasks) mẫu theo 6 Ban
  console.log('6. Đang nạp các nhiệm vụ mẫu theo Ban...');
  const creatorUser = await prisma.user.findFirst({ where: { email: 'hungminh.2310@gmail.com' } });
  const sampleTasks = [
    {
      title: 'Xây dựng giáo trình workshop Gemini 1.5 Pro cho sinh viên',
      description: 'Soạn slides, code samples và codelab hướng dẫn prompt engineering & Gemini API.',
      deptCode: DepartmentType.TECH_AI,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      gemsReward: 50,
      deadline: new Date('2026-10-20T23:59:59Z'),
      assigneeEmail: 'vocaominh7406@gmail.com',
    },
    {
      title: 'Thiết lập GCP Organization & cấp budget cho các ban',
      description: 'Cấu hình IAM, cấp quyền Service Account và theo dõi hạn mức billing GCP.',
      deptCode: DepartmentType.TECH_CLOUD,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      gemsReward: 50,
      deadline: new Date('2026-10-18T23:59:59Z'),
      assigneeEmail: 'votranngochuu@gmail.com',
    },
    {
      title: 'Hoàn thiện Portal GDGoC-OS v2.0 & tích hợp API Backend',
      description: 'Xây dựng giao diện Neo-brutalism, tích hợp JWT Auth HttpOnly cookie, tối ưu hóa Zustand store.',
      deptCode: DepartmentType.TECH_WEB,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.URGENT,
      gemsReward: 100,
      deadline: new Date('2026-10-15T23:59:59Z'),
      assigneeEmail: 'buiphamchinhan@gmail.com',
    },
    {
      title: 'Thu thập & phân tích dữ liệu nghiên cứu bài báo khoa học',
      description: 'Lọc dataset, huấn luyện mô hình benchmark và viết phần thực nghiệm trong bản thảo LaTeX.',
      deptCode: DepartmentType.TECH_RESEARCH,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      gemsReward: 60,
      deadline: new Date('2026-10-30T23:59:59Z'),
      assigneeEmail: 'anhhuybui2006@gmail.com',
    },
    {
      title: 'Thiết kế bộ Key Visual sự kiện Google I/O Extended 2026',
      description: 'Bộ poster, banner Facebook, standee hội trường và avatar frame theo Google Brand Guideline.',
      deptCode: DepartmentType.MEDIA,
      status: TaskStatus.IN_REVIEW,
      priority: TaskPriority.HIGH,
      gemsReward: 40,
      deadline: new Date('2026-10-12T23:59:59Z'),
      assigneeEmail: 'hngbtran@gmail.com',
    },
    {
      title: 'Lên kế hoạch tổ chức & chuẩn bị hậu cần Welcome Gen 4',
      description: 'Đặt phòng, chuẩn bị quà tặng Google swags, phân công lễ tân check-in cho sự kiện.',
      deptCode: DepartmentType.HR_EVENT,
      status: TaskStatus.DONE,
      priority: TaskPriority.MEDIUM,
      gemsReward: 50,
      deadline: new Date('2026-10-05T23:59:59Z'),
      assigneeEmail: 'hoangmai.it.dev@gmail.com',
    },
  ];

  for (const t of sampleTasks) {
    const deptId = deptMap.get(t.deptCode)!;
    const assignee = await prisma.user.findFirst({ where: { email: t.assigneeEmail } });
    await prisma.task.create({
      data: {
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        gemsReward: t.gemsReward,
        deadline: t.deadline,
        tenureId: activeTenure.id,
        departmentId: deptId,
        creatorId: creatorUser ? creatorUser.id : (assignee ? assignee.id : activeTenure.id),
        assignees: assignee ? {
          create: {
            userId: assignee.id,
          }
        } : undefined,
      },
    });
  }
  console.log(`   ✓ Đã tạo ${sampleTasks.length} nhiệm vụ mẫu theo Ban`);

  console.log(`🔑 Tất cả tài khoản có thể đăng nhập bằng Email hoặc MSSV với mật khẩu: ${defaultPassword}`);
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi nạp dữ liệu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
