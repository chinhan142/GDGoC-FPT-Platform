import 'dotenv/config';
import { PrismaClient, DepartmentType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in environment variables');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting database seeding...');

  // 1. Seed 7 Departments
  const departments = [
    {
      code: DepartmentType.EXECUTIVE,
      name: 'Ban Chủ Nhiệm',
      nameEn: 'Executive Board',
    },
    {
      code: DepartmentType.TECH_AI,
      name: 'Ban Trí Tuệ Nhân Tạo',
      nameEn: 'AI Engineering',
    },
    {
      code: DepartmentType.TECH_CLOUD,
      name: 'Ban Điện Toán Đám Mây',
      nameEn: 'Cloud Engineering',
    },
    {
      code: DepartmentType.TECH_WEB,
      name: 'Ban Phát Triển Web',
      nameEn: 'Web Development',
    },
    {
      code: DepartmentType.TECH_RESEARCH,
      name: 'Ban Nghiên Cứu & Học Thuật',
      nameEn: 'Research & Academics',
    },
    {
      code: DepartmentType.MEDIA,
      name: 'Ban Truyền Thông & Thiết Kế',
      nameEn: 'Media & Design',
    },
    {
      code: DepartmentType.HR_EVENT,
      name: 'Ban Nhân Sự & Tổ Chức Sự Kiện',
      nameEn: 'HR & Event Operations',
    },
  ];

  console.log('Seeding Departments...');
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
    console.log(`   - Department: ${upserted.code} -> ${upserted.name}`);
  }

  // 2. Seed Active Tenure (if none exists)
  console.log('Checking Active Tenure...');
  const activeTenure = await prisma.tenure.findFirst({
    where: { isFrozen: false },
  });

  if (!activeTenure) {
    const newTenure = await prisma.tenure.create({
      data: {
        name: 'Fall 2026',
        genLabel: 'Gen 4.0',
        chapterLead: 'Đặng Mai Phương',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        endDate: new Date('2027-01-31T23:59:59.000Z'),
        isFrozen: false,
        isArchived: false,
      },
    });
    console.log(
      `   - Created active tenure: ${newTenure.name} - ${newTenure.genLabel} (${newTenure.id})`,
    );
  } else {
    console.log(
      `   - Active tenure already exists: ${activeTenure.name} (${activeTenure.id})`,
    );
  }

  console.log('Seeding completed successfully!');
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
