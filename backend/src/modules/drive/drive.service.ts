import { isLevelOne, currentMembership, canWork } from '../common/access';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { QueryAssetsDto } from './dto/query-assets.dto';
import { AccessLevel, DepartmentType, Prisma, Role } from '@prisma/client';

@Injectable()
export class DriveService {
  private readonly logger = new Logger(DriveService.name);

  constructor(private readonly prisma: PrismaService) {}

  private visibility(user: any): Prisma.DriveAssetWhereInput {
    const membership = currentMembership(user);
    const active = canWork(membership) && !membership.tenure?.isFrozen && !membership.tenure?.isArchived;
    if (active && isLevelOne(membership.role)) return {};
    return { OR: [
      { accessLevel: AccessLevel.PUBLIC },
      { accessLevel: AccessLevel.INTERNAL_MEMBER },
      ...(active && membership.departmentId ? [{ accessLevel: AccessLevel.DEPARTMENT_ONLY, departmentId: membership.departmentId }] : []),
    ] };
  }

  assertCanView(user: any, asset: { accessLevel: AccessLevel; departmentId: string | null }) {
    const membership = currentMembership(user);
    const active = canWork(membership) && !membership.tenure?.isFrozen && !membership.tenure?.isArchived;
    const allowed = !!user?.id && (asset.accessLevel === AccessLevel.PUBLIC || asset.accessLevel === AccessLevel.INTERNAL_MEMBER
      || (active && isLevelOne(membership.role))
      || (active && asset.accessLevel === AccessLevel.DEPARTMENT_ONLY && !!asset.departmentId && membership.departmentId === asset.departmentId));
    if (!allowed) throw new ForbiddenException('Bạn không có quyền xem tài nguyên này.');
  }

  private manager(user: any) {
    const membership = currentMembership(user);
    if (!canWork(membership) || membership.tenure?.isFrozen || membership.tenure?.isArchived
      || (!isLevelOne(membership.role) && membership.role !== Role.DEPARTMENT_LEAD)) {
      throw new ForbiddenException('Bạn không có quyền quản lý tài nguyên.');
    }
    return membership;
  }

  private assertScope(user: any, departmentId: string | null | undefined, accessLevel: AccessLevel, asset?: any) {
    const membership = this.manager(user);
    if (!isLevelOne(membership.role) && (accessLevel === AccessLevel.EXECUTIVE_ONLY
      || !membership.departmentId || departmentId !== membership.departmentId
      || (asset && (asset.uploadedById !== user.id || asset.departmentId !== membership.departmentId || asset.accessLevel === AccessLevel.EXECUTIVE_ONLY)))) {
      throw new ForbiddenException('Trưởng ban chỉ quản lý tài nguyên mình đăng ký trong ban, không được cấp quyền BCN.');
    }
    if (accessLevel === AccessLevel.DEPARTMENT_ONLY && !departmentId) throw new BadRequestException('Tài nguyên trong ban phải có ban sở hữu.');
  }

  private async resolveDepartment(dto: { departmentId?: string; departmentCode?: DepartmentType }, fallback?: string | null) {
    if (!dto.departmentId && !dto.departmentCode) return fallback;
    const department = await this.prisma.department.findUnique({ where: dto.departmentId ? { id: dto.departmentId } : { code: dto.departmentCode } });
    if (!department || (dto.departmentCode && department.code !== dto.departmentCode)) throw new BadRequestException('Ban sở hữu không hợp lệ.');
    return department.id;
  }

  /**
   * Get list of Drive assets with 4-level access filtering & search
   */
  async findAll(user: any, query: QueryAssetsDto) {
    const {
      category,
      departmentCode,
      accessLevel,
      eventId,
      tenureId,
      search,
      page = 1,
      limit = 20,
    } = query;

    const accessCondition = this.visibility(user);

    const where: Prisma.DriveAssetWhereInput = {
      AND: [accessCondition],
    };

    if (category) where.category = category;
    if (accessLevel) where.accessLevel = accessLevel;
    if (eventId) where.eventId = eventId;
    if (tenureId) where.tenureId = tenureId;

    if (departmentCode) {
      where.department = { code: departmentCode };
    }

    if (search) {
      (where.AND as Prisma.DriveAssetWhereInput[]).push({ OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ] });
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.driveAsset.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          department: {
            select: { id: true, name: true, code: true },
          },
          event: {
            select: { id: true, title: true },
          },
          tenure: {
            select: { id: true, name: true, genLabel: true },
          },
        },
      }),
      this.prisma.driveAsset.count({ where }),
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
   * Get asset detail by ID
   */
  async findOne(id: string) {
    const asset = await this.prisma.driveAsset.findUnique({
      where: { id },
      include: {
        department: true,
        event: true,
        tenure: true,
      },
    });

    if (!asset) {
      throw new NotFoundException(`Drive asset with ID ${id} not found`);
    }

    return asset;
  }

  /**
   * Create new Drive Asset
   */
  async create(user: any, dto: CreateAssetDto) {
    const membership = this.manager(user);
    const departmentId = await this.resolveDepartment(dto, isLevelOne(membership.role) ? undefined : membership.departmentId);
    this.assertScope(user, departmentId, dto.accessLevel || AccessLevel.INTERNAL_MEMBER);

    let tenureId = dto.tenureId;
    if (!tenureId) {
      const activeTenure = await this.prisma.tenure.findFirst({
        where: { isArchived: false },
        orderBy: { startDate: 'desc' },
      });
      if (!activeTenure) {
        throw new BadRequestException('Chưa có nhiệm kỳ hoạt động trong hệ thống.');
      }
      tenureId = activeTenure.id;
    }

    return this.prisma.driveAsset.create({
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        driveUrl: dto.driveUrl,
        driveFileId: dto.driveFileId,
        accessLevel: dto.accessLevel || AccessLevel.INTERNAL_MEMBER,
        uploadedById: user.id,
        departmentId,
        tenureId,
        eventId: dto.eventId,
      },
      include: {
        department: true,
        tenure: true,
        event: true,
      },
    });
  }

  /**
   * Update Drive Asset
   */
  async update(user: any, id: string, dto: UpdateAssetDto) {
    const asset = await this.findOne(id);

    const departmentId = await this.resolveDepartment(dto, asset.departmentId);
    this.assertScope(user, departmentId, dto.accessLevel ?? asset.accessLevel, asset);

    return this.prisma.driveAsset.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        driveUrl: dto.driveUrl,
        driveFileId: dto.driveFileId,
        accessLevel: dto.accessLevel,
        departmentId,
        tenureId: dto.tenureId,
        eventId: dto.eventId,
      },
      include: {
        department: true,
        tenure: true,
        event: true,
      },
    });
  }

  /**
   * Delete Drive Asset
   */
  async remove(user: any, id: string) {
    const asset = await this.findOne(id);

    this.assertScope(user, asset.departmentId, asset.accessLevel, asset);

    await this.prisma.driveAsset.delete({
      where: { id },
    });

    return { message: `Tài nguyên ${id} đã được xóa thành công.` };
  }
}
