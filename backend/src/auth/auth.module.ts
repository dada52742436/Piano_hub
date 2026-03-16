import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy } from './jwt.strategy.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [
    // 引入 UsersModule，让 AuthService 和 JwtStrategy 可以注入 UsersService
    UsersModule,
    // PassportModule 提供 @UseGuards(AuthGuard(...)) 机制的基础支持
    PassportModule,
    // JwtModule.registerAsync：异步注册，目的是等 ConfigService 加载完 .env 后再读取密钥
    // 不能用 JwtModule.register({ secret: '...' }) 硬编码，那样密钥会暴露在代码里
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          // 类型断言：@nestjs/jwt 的 expiresIn 类型定义不接受普通 string，
          // 需要断言为 StringValue（来自 ms 库），但运行时行为完全一致
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ??
            '7d') as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  // JwtStrategy 必须作为 provider 注册，Passport 才能找到并使用它
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
