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

  // 1. Seed Departments
  const departments = [
    {
      code: DepartmentType.TECH,
      name: 'Ban Kỹ Thuật (Tech)',
    },
    {
      code: DepartmentType.MEDIA,
      name: 'Ban Truyền Thông & Media (Media)',
    },
    {
      code: DepartmentType.PR_COMMS,
      name: 'Ban Đối Ngoại (PR & Comms)',
    },
    {
      code: DepartmentType.HR_EVENT,
      name: 'Ban Nhân Sự & Sự Kiện (HR & Event)',
    },
    {
      code: DepartmentType.EXECUTIVE,
      name: 'Ban Chủ Nhiệm (Executive Board)',
    },
  ];

  console.log('Seeding Departments...');
  for (const dept of departments) {
    const upserted = await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name },
      create: {
        code: dept.code,
        name: dept.name,
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
        name: 'Niên khóa 2026 - 2027 (Gen 5)',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        endDate: new Date('2027-08-31T23:59:59.000Z'),
        isFrozen: false,
        isArchived: false,
      },
    });
    console.log(
      `   - Created active tenure: ${newTenure.name} (${newTenure.id})`,
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
