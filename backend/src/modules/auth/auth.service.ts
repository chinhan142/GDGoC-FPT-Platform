import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OnboardMemberDto } from './dto/onboard-member.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import * as generator from 'generate-password';
import { JwtService } from '@nestjs/jwt';
import { ChangePasswordDto } from './dto/change-password.dto';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async onboardMember(dto: OnboardMemberDto, webhookSecret: string) {
    const validSecret = await process.env.GDGOC_FORM_WEBHOOK_SECRET_KEY;

    if (webhookSecret !== validSecret) {
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
      throw new NotFoundException('There is not active tenure!');
    }

    const rawPassword = `GDGoC@${dto.mssv}`;

    const hashPasword = await bcrypt.hash(rawPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        mssv: dto.mssv,
        email: dto.email,
        fullName: dto.fullName,
        passwordHash: hashPasword,
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
      message: 'success',
      safeUser,
      defaultPassword: rawPassword,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (!user) {
      throw new NotFoundException('User does not exist!');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isMatch) {
      throw new UnauthorizedException('Password is not correct!');
    }

    const payload = { sub: user.id, email: user.email, mssv: user.mssv };
    const accessToken = this.jwtService.sign(payload);

    const { passwordHash, ...safeUser } = user;
    return {
      accessToken,
      safeUser,
    };
  }

  async changePassword(dto: ChangePasswordDto, user: User) {
    const dbUser = await this.prisma.user.findUnique({
      where: {
        id: user.id,
      },
    });

    const isMatchOld = await bcrypt.compare(
      dto.oldPassword,
      dbUser.passwordHash,
    );

    if (!isMatchOld) {
      throw new UnauthorizedException('Your old password is not correct!');
    }

    const hashPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash: hashPassword,
      },
    });

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
