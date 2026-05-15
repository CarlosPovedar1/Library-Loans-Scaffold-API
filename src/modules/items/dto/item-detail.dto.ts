import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, MinLength, IsOptional, IsArray } from 'class-validator';

export class ItemDetailDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  id: number;

  @ApiProperty({ example: 'Clean Code' })
  @IsString()
  @MinLength(1)
  title: string;

  @ApiProperty({ example: 'Robert C. Martin' })
  @IsString()
  @MinLength(2)
  author: string;

  @ApiProperty({ example: '978-0132350884' })
  @IsString()
  @MinLength(10)
  isbn: string;

  @ApiProperty({ example: 3, minimum: 1 })
  @IsInt()
  totalCopies: number;

  @ApiProperty({ example: 2, minimum: 0 })
  @IsInt()
  availableCopies: number;

  @ApiProperty({ example: '2026-05-14T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-05-15T12:00:00.000Z' })
  updatedAt: string;

  @ApiProperty({ type: [Number], example: [1, 2], required: false, description: 'IDs de préstamos asociados (si aplica)' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  loanIds?: number[];
}