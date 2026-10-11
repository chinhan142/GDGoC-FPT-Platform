import { Role } from '@prisma/client';

export const LEVEL_ONE_ROLES: Role[] = [Role.LEAD, Role.ADVISOR, Role.ADMIN];
export const isLevelOne = (role: Role | string) =>
  LEVEL_ONE_ROLES.includes(role as Role);
export const canWork = (membership: any) =>
  membership && ['ACTIVE', 'PROBATION'].includes(membership.status);
export const currentMembership = (user: any) =>
  [...(user?.tenures || [])]
    .filter((t) => t.tenure && !t.tenure.isArchived)
    .sort(
      (a, b) =>
        new Date(b.tenure.startDate).getTime() -
        new Date(a.tenure.startDate).getTime(),
    )[0] ||
  [...(user?.tenures || [])].sort(
    (a, b) =>
      new Date(b.tenure?.startDate).getTime() -
      new Date(a.tenure?.startDate).getTime(),
  )[0];

export async function activeSemester(db: any, tenureId?: string) {
  const semester = await db.semester.findFirst({
    where: {
      isClosed: false,
      tenure: { isArchived: false, isFrozen: false },
      ...(tenureId ? { tenureId } : {}),
    },
    orderBy: { startDate: 'desc' },
  });
  if (!semester) {
    const { BadRequestException } = await import('@nestjs/common');
    throw new BadRequestException(
      'Chưa có kỳ học đang hoạt động. Hãy cấu hình kỳ học trước.',
    );
  }
  return semester;
}
