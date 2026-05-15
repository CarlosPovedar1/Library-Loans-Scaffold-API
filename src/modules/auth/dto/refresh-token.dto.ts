import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token received on login/register' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
