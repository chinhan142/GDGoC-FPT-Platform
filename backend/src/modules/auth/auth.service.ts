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

    const rawPassword = generator.generate({
      length: 12,
      numbers: true,
      symbols: true,
      uppercase: true,
      lowercase: true,
      strict: true,
    });

    const hashPasword = await bcrypt.hash(rawPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        mssv: dto.mssv,
        email: dto.email,
        fullName: dto.fullName,
        passwordHash: hashPasword,
      },
    });

    const { passwordHash, ...safeUser } = user;
    return {
      message: 'success',
      safeUser,
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
}
