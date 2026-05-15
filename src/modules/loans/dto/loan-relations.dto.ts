import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional } from 'class-validator';

export class LoanRelationsDto {
  @ApiProperty({ type: [Number], example: [1, 2], required: false, description: 'IDs de ítems asociados al préstamo (si el préstamo puede tener varios ítems)' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  itemIds?: number[];

  @ApiProperty({ example: 1, required: false, description: 'ID del usuario prestatario (si se maneja por relación)' })
  @IsOptional()
  @IsInt()
  borrowerId?: number;

  @ApiProperty({ type: [Number], example: [1], required: false, description: 'IDs de registros relacionados adicionales (ej. historial, multas)' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  relatedRecordIds?: number[];
}