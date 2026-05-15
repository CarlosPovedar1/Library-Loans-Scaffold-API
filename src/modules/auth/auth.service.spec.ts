import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

const mockUserRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('signed-token'),
};

const mockConfigService = {
  get: jest.fn((key: string) => ({ 'bcrypt.saltRounds': 10 }[key])),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    mockJwtService.sign.mockReturnValue('signed-token');
    mockConfigService.get.mockImplementation((key: string) => ({ 'bcrypt.saltRounds': 10 }[key]));
  });

  describe('register', () => {
    it('should create a user and return an access token', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.create.mockReturnValue({ id: 'u1', email: 'a@a.com' });
      mockUserRepo.save.mockResolvedValue({ id: 'u1', email: 'a@a.com' });

      const result = await service.register({
        email: 'a@a.com',
        name: 'Alice',
        password: 'password123',
      });

      expect(result).toEqual({ accessToken: 'signed-token' });
      expect(mockUserRepo.findOne).toHaveBeenCalledWith({ where: { email: 'a@a.com' } });
    });

    it('should throw ConflictException when email already exists', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'u1' });

      await expect(
        service.register({ email: 'a@a.com', name: 'Alice', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return an access token with valid credentials', async () => {
      const hashed = await bcrypt.hash('password123', 10);
      mockUserRepo.findOne.mockResolvedValue({ id: 'u1', email: 'a@a.com', password: hashed, role: 'user' });

      const result = await service.login({ email: 'a@a.com', password: 'password123' });

      expect(result).toEqual({ accessToken: 'signed-token' });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@a.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      const hashed = await bcrypt.hash('correctPass', 10);
      mockUserRepo.findOne.mockResolvedValue({ id: 'u1', email: 'a@a.com', password: hashed, role: 'user' });

      await expect(
        service.login({ email: 'a@a.com', password: 'wrongPass' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
