import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service.js';
import type { User } from '../../generated/prisma/client.js';

interface JwtPayload {
  sub: number;
  email: string;
}

// JwtStrategy 的工作流程：
// 1. 从请求头 Authorization: Bearer <token> 中提取 token
// 2. 用 JWT_SECRET 验证 token 签名，如果签名无效或 token 过期，Passport 自动拒绝
// 3. 签名有效后，调用 validate()，把 payload 里的 userId 还原成完整用户对象
// 4. validate() 返回的值会被挂到 request.user 上，Controller 里可以直接读取
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    configService: ConfigService,
  ) {
    super({
      // 从请求头 "Authorization: Bearer xxx" 中提取 token
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // false = token 过期时不忽略，直接拒绝（安全）
      ignoreExpiration: false,
      // 从环境变量读取密钥，与签发时用的 JWT_SECRET 保持一致
      secretOrKey: configService.get<string>('JWT_SECRET') ?? '',
    });
  }

  // Passport 验证签名成功后自动调用此方法
  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      // token 有效但用户已被删除的情况
      throw new UnauthorizedException('用户不存在');
    }
    // 返回的 user 对象会被 Passport 挂到 req.user
    return user;
  }
}
