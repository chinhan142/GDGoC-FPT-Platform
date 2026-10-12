import { canWork, currentMembership, isLevelOne } from '../common/access';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryMembersDto } from './dto/query-members.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ImportMembersDto } from './dto/import-members.dto';
import { parseMembersExcel } from './utils/excel-parser.util';
import { DepartmentType, MemberStatus, Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private generateInitialCredential(identifier: string): string {
    const prefix = this.configService.getOrThrow<string>('INITIAL_MEMBER_SECRET_PREFIX');
    return `${prefix}${identifier}`;
  }

  private formatMemberResponse(userTenure: any) {
    const user = userTenure.user;
    const mssvDigits = user.mssv
      ? user.mssv.replace(/^\D+/, '').substring(0, 2)
      : '';
    const academicYear =
      userTenure.skills?.find((s: string) => /^K\d+$/i.test(s)) ||
      (mssvDigits ? `K${mssvDigits}` : 'K20');
    const gen =
      userTenure.skills?.find((s: string) => /^GEN/i.test(s)) ||
      userTenure.tenure?.genLabel ||
      'Gen 4.0';

    return {
      id: user.id,
      mssv: user.mssv,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      avatarUrl: user.avatarUrl,
      coverUrl: user.coverUrl,
      academicYear,
      gen,
      tenure: {
        id: userTenure.id,
        role: userTenure.role,
        departmentCode: userTenure.department?.code,
        departmentName: userTenure.department?.name,
        position: userTenure.position,
        status: userTenure.status,
        joinedAt: userTenure.joinedAt,
      },
      gemsBalance: user.gemsBalance,
      skills: userTenure.skills || [],
      bio: userTenure.bio || '',
      socials: {
        facebook: user.facebookUrl || '',
        github: user.githubUrl || '',
        linkedin: user.linkedinUrl || '',
        discord: user.discordUsername || '',
      },
    };
  }

  async getMembers(query: QueryMembersDto, currentUser: any) {
    let tenureId = query.tenureId;
    if (!tenureId || tenureId === 'active') {
      const activeTenure = await this.prisma.tenure.findFirst({
        where: { isFrozen: false, isArchived: false },
        orderBy: { startDate: 'desc' },
      });
      tenureId = activeTenure?.id;
    }

    const where: Prisma.UserTenureWhereInput = {};
    if (!canWork(currentMembership(currentUser))) { where.userId = currentUser.id; tenureId = 'all'; }
    if (tenureId && tenureId !== 'all') {
      where.tenureId = tenureId;
    }

    // RBAC Filter: BCN (LEAD, ADVISOR) and HR_EVENT have full access
    const userActiveTenure =
      currentUser?.tenures?.find(
        (t: any) =>
          (tenureId && t.tenureId === tenureId) || !t.tenure?.isFrozen,
      ) || currentUser?.tenures?.[0];

    const isLeadOrAdvisor =
      isLevelOne(currentMembership(currentUser)?.role) && canWork(currentMembership(currentUser));

    const isHREvent =
      userActiveTenure?.department?.code === DepartmentType.HR_EVENT;

    const isFullAccess = isLeadOrAdvisor || isHREvent;

    if (!isFullAccess && userActiveTenure?.role === Role.DEPARTMENT_LEAD) {
      where.departmentId = userActiveTenure.departmentId;
    }

    if (query.departmentCode && isFullAccess) {
      const dept = await this.prisma.department.findUnique({
        where: { code: query.departmentCode },
      });
      if (dept) {
        where.departmentId = dept.id;
      }
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      const s = query.search.trim();
      where.user = {
        OR: [
          { fullName: { contains: s, mode: 'insensitive' } },
          { mssv: { contains: s, mode: 'insensitive' } },
          { email: { contains: s, mode: 'insensitive' } },
        ],
      };
    }

    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 50;
    const skip = (page - 1) * limit;

    const [total, userTenures] = await Promise.all([
      this.prisma.userTenure.count({ where }),
      this.prisma.userTenure.findMany({
        where,
        include: {
          user: true,
          department: true,
          tenure: true,
        },
        orderBy: [{ role: 'asc' }, { user: { fullName: 'asc' } }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: userTenures.map((ut) => this.formatMemberResponse(ut)),
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async createMember(dto: CreateMemberDto) {
    const department = await this.prisma.department.findUnique({
      where: { code: dto.departmentCode },
    });
    if (!department) {
      throw new NotFoundException(
        `Ban chuyên môn '${dto.departmentCode}' không tồn tại`,
      );
    }

    const tenure = dto.tenureId
      ? await this.prisma.tenure.findUnique({ where: { id: dto.tenureId } })
      : await this.prisma.tenure.findFirst({
          where: { isFrozen: false, isArchived: false },
          orderBy: { startDate: 'desc' },
        });
    if (!tenure) {
      throw new NotFoundException(`Nhiệm kỳ '${dto.tenureId}' không tồn tại`);
    }

    // Find or create user
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { mssv: dto.mssv }],
      },
    });

    if (!user) {
      const initialSecret = this.generateInitialCredential(dto.mssv);
      const passwordHash = await bcrypt.hash(initialSecret, 10);

      user = await this.prisma.user.create({
        data: {
          mssv: dto.mssv,
          fullName: dto.fullName,
          email: dto.email,
          phoneNumber: dto.phoneNumber,
          passwordHash,
        },
      });
    }

    // Check if membership already exists in this tenure
    const existingTenure = await this.prisma.userTenure.findUnique({
      where: {
        userId_tenureId: {
          userId: user.id,
          tenureId: tenure.id,
        },
      },
    });

    if (existingTenure) {
      throw new ConflictException(
        `Thành viên ${user.fullName} (${user.mssv}) đã có trong nhiệm kỳ này!`,
      );
    }

    const userTenure = await this.prisma.userTenure.create({
      data: {
        userId: user.id,
        tenureId: tenure.id,
        departmentId: department.id,
        role: dto.role || Role.MEMBER,
        status: dto.status || MemberStatus.ACTIVE,
        skills: [dto.gen, dto.academicYear].filter((value): value is string => Boolean(value)),
        position: dto.position,
        joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : new Date(),
      },
      include: {
        user: true,
        department: true,
        tenure: true,
      },
    });

    return this.formatMemberResponse(userTenure);
  }

  async updateMember(id: string, dto: UpdateMemberDto) {
    let userTenure = await this.prisma.userTenure.findUnique({
      where: { id },
      include: { user: true, department: true, tenure: true },
    });

    // If not found by userTenure.id, try finding active userTenure by userId
    if (!userTenure) {
      const activeTenure = await this.prisma.tenure.findFirst({
        where: { isFrozen: false },
      });
      if (activeTenure) {
        userTenure = await this.prisma.userTenure.findUnique({
          where: {
            userId_tenureId: {
              userId: id,
              tenureId: activeTenure.id,
            },
          },
          include: { user: true, department: true, tenure: true },
        });
      }
    }

    if (!userTenure) {
      throw new NotFoundException('Không tìm thấy thông tin thành viên');
    }

    let departmentId = userTenure.departmentId;
    if (dto.departmentCode) {
      const dept = await this.prisma.department.findUnique({
        where: { code: dto.departmentCode },
      });
      if (!dept) {
        throw new NotFoundException(
          `Ban chuyên môn '${dto.departmentCode}' không tồn tại`,
        );
      }
      departmentId = dept.id;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userTenure.userId },
        data: { fullName: dto.fullName, mssv: dto.mssv, email: dto.email },
      });
      return tx.userTenure.update({
      where: { id: userTenure.id },
      data: {
        departmentId,
        role: dto.role ?? userTenure.role,
        status: dto.status ?? userTenure.status,
        position: dto.position ?? userTenure.position,
        skills: [
          ...userTenure.skills.filter((skill: string) => !(dto.gen !== undefined && /^GEN/i.test(skill)) && !(dto.academicYear !== undefined && /^K\d+$/i.test(skill))),
          ...[dto.gen, dto.academicYear].filter((value): value is string => Boolean(value)),
        ],
      },
      include: {
        user: true,
        department: true,
        tenure: true,
      },
      });
    });
    return this.formatMemberResponse(updated);
  }

  async deleteMember(id: string) {
    let userTenure = await this.prisma.userTenure.findUnique({
      where: { id },
    });

    if (!userTenure) {
      const activeTenure = await this.prisma.tenure.findFirst({
        where: { isFrozen: false },
      });
      if (activeTenure) {
        userTenure = await this.prisma.userTenure.findUnique({
          where: {
            userId_tenureId: {
              userId: id,
              tenureId: activeTenure.id,
            },
          },
        });
      }
    }

    if (!userTenure) {
      throw new NotFoundException('Không tìm thấy thành viên để cập nhật');
    }

    // Soft delete by updating status to ALUMNI
    await this.prisma.userTenure.update({
      where: { id: userTenure.id },
      data: {
        status: MemberStatus.ALUMNI,
      },
    });

    return;
  }

  async importMembers(file: Express.Multer.File, dto: ImportMembersDto) {
    if (!file || !file.buffer) {
      throw new BadRequestException(
        'Vui lòng tải lên file Excel (.xlsx hoặc .csv)',
      );
    }

    let tenureId = dto.tenureId;
    if (!tenureId) {
      const activeTenure = await this.prisma.tenure.findFirst({
        where: { isFrozen: false },
        orderBy: { startDate: 'desc' },
      });
      tenureId = activeTenure?.id;
    }

    if (!tenureId) {
      throw new BadRequestException('Không tìm thấy nhiệm kỳ để import');
    }

    const { validRows, parseErrors } = parseMembersExcel(
      file.buffer,
      dto.departmentCode,
      dto.defaultRole,
    );

    const departments = await this.prisma.department.findMany();
    const deptMap = new Map(departments.map((d) => [d.code, d.id]));

    let added = 0;
    let skipped = 0;
    const errors: string[] = [...parseErrors];

    for (const row of validRows) {
      try {
        const deptId = deptMap.get(row.departmentCode!);
        if (!deptId) {
          errors.push(
            `Dòng ${row.rowNumber}: Ban '${row.departmentCode}' không tồn tại trong hệ thống`,
          );
          skipped++;
          continue;
        }

        // Find or create User
        let user = await this.prisma.user.findFirst({
          where: {
            OR: [{ email: row.email }, { mssv: row.mssv }],
          },
        });

        if (!user) {
          const initialSecret = this.generateInitialCredential(row.mssv);
          const passwordHash = await bcrypt.hash(initialSecret, 10);
          user = await this.prisma.user.create({
            data: {
              mssv: row.mssv,
              fullName: row.fullName,
              email: row.email,
              phoneNumber: row.phoneNumber,
              passwordHash,
            },
          });
        }

        // Check tenure membership
        const existingTenure = await this.prisma.userTenure.findUnique({
          where: {
            userId_tenureId: {
              userId: user.id,
              tenureId,
            },
          },
        });

        if (existingTenure) {
          errors.push(
            `Dòng ${row.rowNumber}: ${row.fullName} (${row.mssv}) đã thuộc nhiệm kỳ này`,
          );
          skipped++;
          continue;
        }

        await this.prisma.userTenure.create({
          data: {
            userId: user.id,
            tenureId,
            departmentId: deptId,
            role: row.role || Role.MEMBER,
            status: MemberStatus.ACTIVE,
            position: row.position,
          },
        });

        added++;
      } catch (err: any) {
        errors.push(`Dòng ${row.rowNumber}: Lỗi xử lý - ${err.message}`);
        skipped++;
      }
    }

    return {
      added,
      skipped,
      errors,
    };
  }

  async uploadProfileImage(kind: string, file: Express.Multer.File, currentUser: any) {
    if (!canWork(currentMembership(currentUser))) throw new ForbiddenException('Tài khoản chỉ có quyền xem.');
    if (!['avatar', 'cover'].includes(kind)) throw new BadRequestException('Loại ảnh không hợp lệ.');
    if (!file?.buffer?.length || file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Chọn ảnh tối đa 5 MB.');
    }
    const buffer = file.buffer;
    const mime = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? 'image/png'
      : buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
      ? 'image/jpeg'
      : buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
      ? 'image/webp' : null;
    if (!mime) throw new BadRequestException('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.');
    const cloud = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const key = this.configService.get<string>('CLOUDINARY_API_KEY');
    const secret = this.configService.get<string>('CLOUDINARY_API_SECRET');
    if (!cloud || !key || !secret) throw new ServiceUnavailableException('Chưa cấu hình dịch vụ upload ảnh.');
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buffer)], { type: mime }), 'profile-image');
    form.append('public_id', `gdgoc/profiles/${currentUser.id}/${kind}-${randomUUID()}`);
    form.append('overwrite', 'false');
    let result: { secure_url?: string };
    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` },
        body: form,
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error('Upload rejected');
      result = await response.json();
      if (!result.secure_url?.startsWith(`https://res.cloudinary.com/${cloud}/`)) throw new Error('Invalid image URL');
    } catch {
      throw new ServiceUnavailableException('Không thể tải ảnh lên. Vui lòng thử lại.');
    }
    await this.prisma.user.update({
      where: { id: currentUser.id },
      data: kind === 'avatar' ? { avatarUrl: result.secure_url } : { coverUrl: result.secure_url },
    });
    return { url: result.secure_url, kind };
  }

  async updateProfile(
    targetUserId: string,
    dto: UpdateProfileDto,
    currentUser: any,
  ) {
    if (!canWork(currentMembership(currentUser))) throw new ForbiddenException('Alumni chỉ có quyền xem hồ sơ.');
    const isOwner = currentUser.id === targetUserId;
    if (!isOwner) {
      throw new ForbiddenException(
        'Bạn chỉ có quyền cập nhật hồ sơ của chính mình',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        tenures: {
          include: { department: true, tenure: true },
          orderBy: { tenure: { startDate: 'desc' } },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    // Update User level details
    const userUpdateData: Prisma.UserUpdateInput = {};
    if (dto.phoneNumber !== undefined)
      userUpdateData.phoneNumber = dto.phoneNumber;
    if (dto.avatarUrl !== undefined) userUpdateData.avatarUrl = dto.avatarUrl;
    if (dto.githubUrl !== undefined) userUpdateData.githubUrl = dto.githubUrl;
    if (dto.linkedinUrl !== undefined)
      userUpdateData.linkedinUrl = dto.linkedinUrl;
    if (dto.facebookUrl !== undefined)
      userUpdateData.facebookUrl = dto.facebookUrl;
    if (dto.discordUsername !== undefined)
      userUpdateData.discordUsername = dto.discordUsername;

    if (Object.keys(userUpdateData).length > 0) {
      await this.prisma.user.update({
        where: { id: targetUserId },
        data: userUpdateData,
      });
    }

    // Update active UserTenure bio & skills
    const activeTenure =
      user.tenures.find((t) => !t.tenure.isFrozen) || user.tenures[0];

    if (
      activeTenure &&
      (dto.bio !== undefined || dto.skills !== undefined)
    ) {
      const tenureUpdateData: Prisma.UserTenureUpdateInput = {};
      if (dto.bio !== undefined) tenureUpdateData.bio = dto.bio;
      if (dto.skills !== undefined) tenureUpdateData.skills = [
        ...activeTenure.skills.filter((skill: string) => /^GEN/i.test(skill) || /^K\d+$/i.test(skill)),
        ...dto.skills,
      ];

      await this.prisma.userTenure.update({
        where: { id: activeTenure.id },
        data: tenureUpdateData,
      });
    }

    const refreshed = await this.prisma.userTenure.findFirst({
      where: {
        userId: targetUserId,
        ...(activeTenure ? { id: activeTenure.id } : {}),
      },
      include: {
        user: true,
        department: true,
        tenure: true,
      },
    });

    if (refreshed) {
      return this.formatMemberResponse(refreshed);
    }

    // Fallback if no tenure yet
    const refreshedUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    return {
      id: refreshedUser!.id,
      mssv: refreshedUser!.mssv,
      fullName: refreshedUser!.fullName,
      email: refreshedUser!.email,
      phoneNumber: refreshedUser!.phoneNumber,
      avatarUrl: refreshedUser!.avatarUrl,
      coverUrl: refreshedUser!.coverUrl,
      tenure: null,
      gemsBalance: refreshedUser!.gemsBalance,
      skills: [],
      bio: '',
    };
  }

  async getOrganizers(featured?: boolean) {
    const activeTenure = await this.prisma.tenure.findFirst({
      where: { isFrozen: false },
      orderBy: { startDate: 'desc' },
    });

    if (!activeTenure) {
      return [];
    }

    const organizers = await this.prisma.userTenure.findMany({
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

    return organizers.map((org) => ({
      id: org.user.id,
      fullName: org.user.fullName,
      position: org.position || org.role,
      avatarUrl: org.user.avatarUrl,
      githubUrl: org.user.githubUrl,
      linkedinUrl: org.user.linkedinUrl,
      domain: org.department?.name || 'Ban Điều Hành',
    }));
  }
}
