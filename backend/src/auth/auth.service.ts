import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';

// JWT payload 的结构：存入 token 的内容
// 只存 sub (userId) 和 email，不存密码等敏感信息
interface JwtPayload {
  sub: number;
  email: string;
}

// 登录/注册成功后返回给前端的数据结构
export interface AuthResponse {
  accessToken: string;
  user: {
    id: number;
    email: string;
    username: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // ── 注册 ──────────────────────────────────────────────
  async register(dto: RegisterDto): Promise<AuthResponse> {
    // 1. 检查 email 是否已被注册
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      // 409 Conflict：资源已存在，语义比 400 更准确
      throw new ConflictException('该邮箱已被注册');
    }

    // 2. 用 bcrypt 对密码进行哈希处理
    // saltRounds=10 意味着计算 2^10=1024 次，足够慢以抵御暴力破解
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 3. 写入数据库（存 hash，永远不存明文）
    const user = await this.usersService.create({
      email: dto.email,
      username: dto.username,
      password: hashedPassword,
    });

    // 4. 注册成功后直接签发 token，前端不需要二次登录
    return this.buildAuthResponse(user);
  }

  // ── 登录 ──────────────────────────────────────────────
  async login(dto: LoginDto): Promise<AuthResponse> {
    // 1. 按 email 查找用户
    const user = await this.usersService.findByEmail(dto.email);

    // 2. 用 bcrypt.compare 对比输入的明文和数据库的 hash
    // 注意：不管是"用户不存在"还是"密码错误"，都返回同样的错误信息
    // 原因：防止攻击者通过不同错误信息来枚举哪些邮箱已注册（信息泄露）
    const isPasswordValid =
      user && (await bcrypt.compare(dto.password, user.password));

    if (!isPasswordValid) {
      // 401 Unauthorized：凭证无效
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 3. 验证通过，签发 JWT
    return this.buildAuthResponse(user);
  }

  // ── 私有方法：构建统一的返回结构 ────────────────────────
  private buildAuthResponse(user: {
    id: number;
    email: string;
    username: string;
  }): AuthResponse {
    const payload: JwtPayload = { sub: user.id, email: user.email };

    return {
      // jwtService.sign() 用 JWT_SECRET 对 payload 签名，生成 token 字符串
      accessToken: this.jwtService.sign(payload),
      // 只返回安全的用户字段，絕對不能把 password hash 返回给前端
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
    };
  }
}
