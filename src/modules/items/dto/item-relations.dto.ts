import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class ItemRelationsDto {
  @ApiPropertyOptional({ type: [String], description: 'IDs of associated loans' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  loanIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'IDs of active reservations' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  reservationIds?: string[];
}
