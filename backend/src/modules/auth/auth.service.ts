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
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailService } from '../mail/mail.service';
import { Response } from 'express';
import { Role, DepartmentType } from '@prisma/client';
import { currentMembership } from '../common/access';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
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
      maxAge: 24 * 60 * 60 * 1000, // Matches JWT expiresIn: 1d.
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
      secure: process.env.NODE_ENV === 'production',
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

  async forgotPassword(dto: ForgotPasswordDto) {
    const identifier = dto.email.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: identifier, mode: 'insensitive' } },
          { mssv: { equals: identifier, mode: 'insensitive' } },
        ],
      },
    });

    // To prevent user enumeration attacks, return identical generic message
    const genericResponse = {
      message:
        'Nếu email hoặc MSSV hợp lệ, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu trong hộp thư của tài khoản.',
    };

    if (!user) {
      return genericResponse;
    }

    // Generate cryptographically secure random token (64 hex characters)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: expires,
      },
    });

    const frontendUrl =
      this.configService.get<string>('APP_FRONTEND_URL') ||
      process.env.APP_FRONTEND_URL ||
      'http://localhost:3000';

    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    const sent = await this.mailService.sendPasswordResetEmail(user.email, user.fullName, resetUrl);
    if (!sent) {
      // Do not clear a newer reset request that may have arrived while sending.
      await this.prisma.user.updateMany({
        where: { id: user.id, resetPasswordToken: hashedToken },
        data: { resetPasswordToken: null, resetPasswordExpires: null },
      });
    }

    return genericResponse;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const hashedToken = crypto.createHash('sha256').update(dto.token.trim()).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException(
        'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng gửi lại yêu cầu mới.',
      );
    }

    if (await bcrypt.compare(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException('Mật khẩu mới không được trùng với mật khẩu gần nhất của bạn.');
    }

    const hashPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        mustChangePassword: false,
      },
    });

    return {
      message: 'Đặt lại mật khẩu thành công! Bạn có thể sử dụng mật khẩu mới để đăng nhập.',
    };
  }

}
