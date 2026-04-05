import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { User } from '../../generated/prisma/client.js';
import { UsersService } from '../users/users.service.js';
import { extractAuthCookieToken } from './auth-cookie.util.js';

interface JwtPayload {
  sub: number;
  email: string;
}

function extractJwtFromCookieOrHeader(request: Request): string | null {
  return (
    extractAuthCookieToken(request) ??
    ExtractJwt.fromAuthHeaderAsBearerToken()(request) ??
    null
  );
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: extractJwtFromCookieOrHeader,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? '',
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return user;
  }
}
