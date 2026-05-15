import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class LoanRelationsDto {
  @ApiPropertyOptional({ type: [String], description: 'Related reservation IDs' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  reservationIds?: string[];
}
