import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { OnboardMemberDto } from './dto/onboard-member.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Response } from 'express';
import { Role, DepartmentType } from '@prisma/client';
import { currentMembership } from '../common/access';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private generateInitialCredential(identifier: string): string {
    const prefix = this.configService.getOrThrow<string>('INITIAL_MEMBER_SECRET_PREFIX');
    return `${prefix}${identifier}`;
  }

  async onboardMember(dto: OnboardMemberDto, webhookSecret: string) {
    const validSecret =
      this.configService.get<string>('GDGOC_FORM_WEBHOOK_SECRET_KEY') ||
      process.env.GDGOC_FORM_WEBHOOK_SECRET_KEY;

    if (!validSecret || !webhookSecret || webhookSecret !== validSecret) {
      throw new UnauthorizedException('Secret key is not valid!');
    }

    const isExist = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (isExist) {
      throw new ConflictException('This user is already exist!');
    }

    const department = await this.prisma.department.findFirst({
      where: {
        code: dto.departmentCode,
      },
    });

    if (!department) {
      throw new NotFoundException('Department code does not exist!');
    }

    const currentTenure = await this.prisma.tenure.findFirst({
      where: {
        isFrozen: false,
      },
    });

    if (!currentTenure) {
      throw new NotFoundException('There is no active tenure!');
    }

    const initialSecret = this.generateInitialCredential(dto.mssv);
    const hashPassword = await bcrypt.hash(initialSecret, 10);

    const user = await this.prisma.user.create({
      data: {
        mssv: dto.mssv,
        email: dto.email,
        fullName: dto.fullName,
        passwordHash: hashPassword,
        tenures: {
          create: {
            tenureId: currentTenure.id,
            departmentId: department.id,
          },
        },
      },
      include: {
        tenures: true,
      },
    });

    const { passwordHash, ...safeUser } = user;
    return {
      safeUser,
      defaultPassword: initialSecret,
    };
  }

  async login(dto: LoginDto, res: Response) {
    const identifier = dto.email.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: identifier, mode: 'insensitive' } },
          { mssv: { equals: identifier, mode: 'insensitive' } },
        ],
      },
      include: {
        tenures: {
          include: {
            tenure: true,
            department: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, mssv: user.mssv };
    const accessToken = this.jwtService.sign(payload);

    // Set HttpOnly cookie according to API Contract
    res.cookie('session_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const activeTenure = currentMembership(user);

    return {
      id: user.id,
      mustChangePassword: user.mustChangePassword,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      currentTenure: activeTenure
        ? {
            role: activeTenure.role,
            departmentCode: activeTenure.department.code,
            departmentName: activeTenure.department.name,
            status: activeTenure.status,
            position: activeTenure.position,
          }
        : null,
    };
  }

  async getMe(user: any) {
    const activeTenure = currentMembership(user);

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      mssv: user.mssv,
      avatarUrl: user.avatarUrl,
      gemsBalance: user.gemsBalance,
      mustChangePassword: user.mustChangePassword,
      readOnly: activeTenure?.status === 'ALUMNI' || activeTenure?.status === 'ON_LEAVE',
      currentTenure: activeTenure
        ? {
            role: activeTenure.role,
            departmentCode: activeTenure.department?.code,
            departmentName: activeTenure.department?.name,
            status: activeTenure.status,
            position: activeTenure.position,
          }
        : null,
    };
  }

  async logout(res: Response) {
    res.clearCookie('session_token', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
    return { message: 'Logged out' };
  }

  async changePassword(dto: ChangePasswordDto, userId: string) {
    const dbUser = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!dbUser) {
      throw new NotFoundException('User not found');
    }

    const isMatchOld = await bcrypt.compare(
      dto.oldPassword,
      dbUser.passwordHash,
    );

    if (!isMatchOld) {
      throw new UnauthorizedException('Your old password is not correct!');
    }
    if (await bcrypt.compare(dto.newPassword, dbUser.passwordHash)) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại.');
    }

    const hashPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        passwordHash: hashPassword,
        mustChangePassword: false,
      },
    });

    return { message: 'Password changed successfully' };
  }

}
