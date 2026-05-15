import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';

@Injectable()
export class RefreshTokensService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly repo: Repository<RefreshToken>,
  ) {}

  create(userId: string, jti: string, expiresAt: Date): Promise<RefreshToken> {
    const rt = this.repo.create({ userId, jti, expiresAt, revokedAt: null });
    return this.repo.save(rt);
  }

  findByJti(jti: string): Promise<RefreshToken | null> {
    return this.repo.findOne({ where: { jti } });
  }

  async revokeByJti(jti: string): Promise<void> {
    await this.repo.update({ jti }, { revokedAt: new Date() });
  }
}
