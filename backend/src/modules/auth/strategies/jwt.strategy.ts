import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';

const cookieOrBearerExtractor = (req: Request): string | null => {
  if (req && req.cookies && req.cookies['session_token']) {
    return req.cookies['session_token'];
  }
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: cookieOrBearerExtractor,
      secretOrKey: process.env.JWT_SECRET || 'gdgoc_default_secret_key_2026',
    });
  }

  async validate(payload: { sub: string }) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub,
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
      throw new UnauthorizedException('User does not exist!');
    }

    return user;
  }
}
