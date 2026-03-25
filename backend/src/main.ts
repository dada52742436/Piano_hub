import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 允许前端开发服务器（localhost:3000）跨域访问
  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

  // 全局启用 DTO 校验管道
  // whitelist: true              — 过滤掉 DTO 中未声明的字段，防止恶意注入
  // forbidNonWhitelisted: true   — 遇到多余字段直接 400，而非静默忽略
  // transform: true              — 自动将请求数据转成 DTO 实例（而非纯对象）
  // enableImplicitConversion     — query string "1" → number 1，无需 @Type(() => Number)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger / OpenAPI 接口文档
  // 访问地址： http://localhost:3001/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('PianoHub API')
    .setDescription('Melbourne second-hand piano trading platform — REST API reference')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
