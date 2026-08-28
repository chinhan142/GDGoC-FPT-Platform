import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OnboardMemberDto } from './dto/onboard-member.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async onboardMember(dto: OnboardMemberDto) {
    throw new Error('Method not implemented.');
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
