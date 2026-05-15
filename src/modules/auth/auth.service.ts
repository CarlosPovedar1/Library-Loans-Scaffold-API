import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { RefreshTokensService } from '@modules/refresh-tokens/refresh-tokens.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { User, UserRole } from './entities/user.entity';
import { JwtPayload } from './strategies/jwt.strategy';

interface RefreshPayload extends JwtPayload {
  jti: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: Omit<User, 'password'>;
}

function parseDurationMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) return 7 * 24 * 3600 * 1000;
  const value = parseInt(match[1], 10);
  const multipliers: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * (multipliers[match[2]] ?? 86_400_000);
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly refreshTokensService: RefreshTokensService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const saltRounds = this.configService.get<number>('bcrypt.saltRounds') ?? 10;
    const hashedPassword = await bcrypt.hash(dto.password, saltRounds);

    const user = this.userRepository.create({ ...dto, password: hashedPassword });
    const saved = await this.userRepository.save(user);

    return this.buildAuthResponse(saved);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
      select: ['id', 'email', 'name', 'password', 'role', 'createdAt', 'updatedAt'],
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    return this.buildAuthResponse(user);
  }

  async refresh(token: string): Promise<{ accessToken: string }> {
    let payload: RefreshPayload;
    try {
      payload = this.jwtService.verify<RefreshPayload>(token, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const record = await this.refreshTokensService.findByJti(payload.jti);
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is revoked or expired');
    }

    await this.refreshTokensService.revokeByJti(payload.jti);

    const jti = randomUUID();
    const expiresIn = this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d';
    const expiresAt = new Date(Date.now() + parseDurationMs(expiresIn));
    await this.refreshTokensService.create(payload.sub, jti, expiresAt);

    const newRefreshToken = this.signRefreshToken(payload.sub, payload.email, payload.role, jti);
    const accessToken = this.signAccessToken(payload.sub, payload.email, payload.role);

    return { accessToken, refreshToken: newRefreshToken } as { accessToken: string; refreshToken: string };
  }

  async logout(token: string): Promise<{ message: string }> {
    let payload: RefreshPayload;
    try {
      payload = this.jwtService.verify<RefreshPayload>(token, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.refreshTokensService.revokeByJti(payload.jti);
    return { message: 'Logged out successfully' };
  }

  private async buildAuthResponse(user: User): Promise<AuthResponse> {
    const jti = randomUUID();
    const expiresIn = this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d';
    const expiresAt = new Date(Date.now() + parseDurationMs(expiresIn));

    await this.refreshTokensService.create(user.id, jti, expiresAt);

    const accessToken = this.signAccessToken(user.id, user.email, user.role);
    const refreshToken = this.signRefreshToken(user.id, user.email, user.role, jti);

    const { password: _pw, ...safeUser } = user as User & { password?: string };
    void _pw;

    return { accessToken, refreshToken, user: safeUser as Omit<User, 'password'> };
  }

  private signAccessToken(userId: string, email: string, role: UserRole): string {
    const payload: JwtPayload = { sub: userId, email, role };
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: this.configService.get<string>('jwt.accessExpiresIn') ?? '15m',
    });
  }

  private signRefreshToken(userId: string, email: string, role: UserRole, jti: string): string {
    const payload: RefreshPayload = { sub: userId, email, role, jti };
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d',
    });
  }
}
