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
import { CreateEventFolderDto } from './dto/create-event-folder';
import { AccessLevel, DepartmentType, Prisma, Role } from '@prisma/client';

@Injectable()
export class DriveService {
  private readonly logger = new Logger(DriveService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mock / Placeholder for Google Drive API folder creation
   */
  async createEventFolder(dto: CreateEventFolderDto) {
    this.logger.log(`Created mock Google Drive folder for event ${dto.eventId}`);
    return {
      folderId: `folder_${Date.now()}`,
      folderUrl: `https://drive.google.com/drive/folders/mock_${dto.eventId}`,
      eventId: dto.eventId,
    };
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

    const isLead = user?.tenures?.some((t: any) => t.role === Role.LEAD);
    const isAdvisor = user?.tenures?.some((t: any) => t.role === Role.ADVISOR);

    const userDepartmentIds: string[] = [];
    if (user?.tenures) {
      for (const t of user.tenures) {
        if (t.departmentId && !userDepartmentIds.includes(t.departmentId)) {
          userDepartmentIds.push(t.departmentId);
        }
      }
    }

    // Access Level Visibility Matrix
    let accessCondition: Prisma.DriveAssetWhereInput = {};

    if (!isLead) {
      if (isAdvisor) {
        // Advisors can view PUBLIC, INTERNAL_MEMBER, DEPARTMENT_ONLY
        accessCondition = {
          accessLevel: {
            in: [
              AccessLevel.PUBLIC,
              AccessLevel.INTERNAL_MEMBER,
              AccessLevel.DEPARTMENT_ONLY,
            ],
          },
        };
      } else {
        // Standard Members: PUBLIC, INTERNAL_MEMBER, or DEPARTMENT_ONLY (if in same department)
        accessCondition = {
          OR: [
            { accessLevel: AccessLevel.PUBLIC },
            { accessLevel: AccessLevel.INTERNAL_MEMBER },
            {
              accessLevel: AccessLevel.DEPARTMENT_ONLY,
              departmentId: { in: userDepartmentIds },
            },
          ],
        };
      }
    }

    const where: Prisma.DriveAssetWhereInput = {
      ...accessCondition,
    };

    if (category) where.category = category;
    if (accessLevel) where.accessLevel = accessLevel;
    if (eventId) where.eventId = eventId;
    if (tenureId) where.tenureId = tenureId;

    if (departmentCode) {
      where.department = { code: departmentCode };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
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
  async create(userId: string, dto: CreateAssetDto) {
    let departmentId = dto.departmentId;

    if (!departmentId && dto.departmentCode) {
      const dept = await this.prisma.department.findUnique({
        where: { code: dto.departmentCode },
      });
      if (dept) departmentId = dept.id;
    }

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
        uploadedById: userId,
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

    const isLead = user?.tenures?.some((t: any) => t.role === Role.LEAD);
    const isOwner = asset.uploadedById === user.id;

    if (!isLead && !isOwner) {
      throw new ForbiddenException(
        'Bạn chỉ có quyền cập nhật tài nguyên do chính mình tạo ra.',
      );
    }

    let departmentId = dto.departmentId !== undefined ? dto.departmentId : asset.departmentId;
    if (dto.departmentCode) {
      const dept = await this.prisma.department.findUnique({
        where: { code: dto.departmentCode },
      });
      if (dept) departmentId = dept.id;
    }

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

    const isLead = user?.tenures?.some((t: any) => t.role === Role.LEAD);
    const isOwner = asset.uploadedById === user.id;

    if (!isLead && !isOwner) {
      throw new ForbiddenException(
        'Bạn chỉ có quyền xóa tài nguyên do chính mình tạo ra.',
      );
    }

    await this.prisma.driveAsset.delete({
      where: { id },
    });

    return { message: `Tài nguyên ${id} đã được xóa thành công.` };
  }
}
