import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';

const cookieOrBearerExtractor = (req: Request): string | null => {
  if (req && req.cookies && req.cookies['session_token']) {
    return req.cookies['session_token'];
  }
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: cookieOrBearerExtractor,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: { sub: string; ver?: number }) {
    if (typeof payload.sub !== 'string' || !Number.isInteger(payload.ver)) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ.');
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

    if (!user || user.sessionVersion !== payload.ver) {
      throw new UnauthorizedException('User does not exist!');
    }

    return user;
  }
}
