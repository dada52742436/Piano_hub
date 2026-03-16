import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

// DTO (Data Transfer Object) 作用：
// 1. 定义前端传来的数据结构
// 2. 配合 class-validator 自动校验字段，不合法直接 400，不进 Service
export class RegisterDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @IsString()
  @MinLength(2, { message: '用户名至少 2 个字符' })
  @MaxLength(20, { message: '用户名最多 20 个字符' })
  username: string;

  @IsString()
  @MinLength(6, { message: '密码至少 6 个字符' })
  @MaxLength(50, { message: '密码最多 50 个字符' })
  password: string;
}
