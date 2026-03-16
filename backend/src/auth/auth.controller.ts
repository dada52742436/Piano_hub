import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService, type AuthResponse } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

// Controller 只负责：接收请求、调用 Service、返回结果
// 所有业务逻辑（加密、token签发等）都在 AuthService 里
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/register
  // 默认 HTTP 状态码是 201 Created，注册语义上是创建资源，201 正确
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  // POST /auth/login
  // @HttpCode(200)：登录不是创建资源，返回 200 比 201 更准确
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }
}
