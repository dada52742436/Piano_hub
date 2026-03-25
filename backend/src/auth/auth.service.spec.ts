// Prevent loading UsersService → PrismaService → generated Prisma client
jest.mock('../users/users.service', () => ({
  UsersService: class MockUsersService {},
}));

// Replace bcrypt with controllable jest.fn() so we can drive hash/compare results
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const mockUser = {
  id: 1,
  email: 'alice@example.com',
  username: 'alice',
  password: 'hashed-password',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUsersService = {
  findByEmail: jest.fn(),
  create: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
};

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockJwtService.sign.mockReturnValue('signed.jwt.token');
    // Default: hash produces a plausible bcrypt-style string; compare rejects
    (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$mock-hashed-password');
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── register ────────────────────────────────────────────────────────────────

  describe('register', () => {
    it('throws ConflictException when the email is already taken', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register({ email: 'alice@example.com', username: 'alice', password: 'pw' }),
      ).rejects.toThrow(ConflictException);

      expect(mockUsersService.create).not.toHaveBeenCalled();
    });

    it('hashes the password before storing and returns a JWT', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue(mockUser);

      const result = await service.register({
        email: 'new@example.com',
        username: 'newuser',
        password: 'plaintext-password',
      });

      // The stored password must not be the plain-text value
      const createCall = mockUsersService.create.mock.calls[0][0] as { password: string };
      expect(createCall.password).not.toBe('plaintext-password');
      expect(createCall.password).toBe('$2b$10$mock-hashed-password');

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.email).toBe(mockUser.email);
      expect(result.user.id).toBe(mockUser.id);
    });
  });

  // ── login ────────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('throws UnauthorizedException when the email is not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'pw' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the password is wrong', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      // compare already returns false by default from beforeEach

      await expect(
        service.login({ email: 'alice@example.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns a JWT when credentials are valid', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'alice@example.com',
        password: 'correct-password',
      });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.id).toBe(mockUser.id);
      expect(result.user.email).toBe(mockUser.email);
      expect(result.user.username).toBe(mockUser.username);
    });

    it('does not expose the password hash in the response', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ email: 'alice@example.com', password: 'pw' });

      expect(result.user).not.toHaveProperty('password');
    });
  });
});
