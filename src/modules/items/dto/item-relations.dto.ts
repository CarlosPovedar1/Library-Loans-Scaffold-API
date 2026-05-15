import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional } from 'class-validator';

export class ItemRelationsDto {
  @ApiProperty({ type: [Number], example: [1, 2], required: false, description: 'IDs de préstamos relacionados' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  loanIds?: number[];

  @ApiProperty({ type: [Number], example: [10, 11], required: false, description: 'IDs de categorías o etiquetas' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  categoryIds?: number[];
}