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
      secretOrKey: configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'gdgoc_jwt_session_token_key',
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
