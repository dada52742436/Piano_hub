import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let prismaService: PrismaService;
  const createdEmails: string[] = [];

  function buildUniqueEmail(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    prismaService = app.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await prismaService.prisma.user.deleteMany({
        where: {
          email: { in: createdEmails },
        },
      });
    }

    await app.close();
  });

  it('POST /auth/register should create a new user and return an access token', async () => {
    const email = buildUniqueEmail('e2e-register');
    createdEmails.push(email);

    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        username: 'e2e-user',
        password: 'secret123',
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.accessToken).toEqual(expect.any(String));
        expect(response.body.user).toMatchObject({
          email,
          username: 'e2e-user',
        });
        expect(response.body.user.id).toEqual(expect.any(Number));
      });
  });

  it('POST /auth/register should return 409 when the email is already registered', async () => {
    const email = buildUniqueEmail('e2e-duplicate');
    createdEmails.push(email);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        username: 'first-user',
        password: 'secret123',
      })
      .expect(201);

    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        username: 'second-user',
        password: 'secret123',
      })
      .expect(409);
  });

  it('POST /auth/login should return an access token for valid credentials', async () => {
    const email = buildUniqueEmail('e2e-login');
    createdEmails.push(email);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        username: 'login-user',
        password: 'secret123',
      })
      .expect(201);

    return request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password: 'secret123',
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.accessToken).toEqual(expect.any(String));
        expect(response.body.user).toMatchObject({
          email,
          username: 'login-user',
        });
      });
  });

  it('POST /auth/login should return 401 for invalid credentials', async () => {
    const email = buildUniqueEmail('e2e-invalid-login');
    createdEmails.push(email);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        username: 'invalid-login-user',
        password: 'secret123',
      })
      .expect(201);

    return request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password: 'wrong-password',
      })
      .expect(401);
  });

  it('GET /protected/profile should return the current user for a valid bearer token', async () => {
    const email = buildUniqueEmail('e2e-profile');
    createdEmails.push(email);

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        username: 'profile-user',
        password: 'secret123',
      })
      .expect(201);

    return request(app.getHttpServer())
      .get('/protected/profile')
      .set('Authorization', `Bearer ${registerResponse.body.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.message).toEqual(expect.any(String));
        expect(response.body.user).toMatchObject({
          email,
          username: 'profile-user',
        });
        expect(response.body.user.password).toBeUndefined();
      });
  });
});
