import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// 把 Passport 的 'jwt' 策略封装成 NestJS 的 Guard
// 使用时：@UseGuards(JwtAuthGuard) 加在 Controller 或具体路由上
// 效果：请求必须携带有效的 Bearer Token，否则直接返回 401
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
