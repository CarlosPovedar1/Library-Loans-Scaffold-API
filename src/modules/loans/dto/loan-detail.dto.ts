import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsDateString } from 'class-validator';

export class LoanDetailDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  id: number;

  @ApiProperty({ example: 1, description: 'ID del usuario que toma el préstamo' })
  @IsInt()
  borrowerId: number;

  @ApiProperty({ example: 1, description: 'ID del ítem prestado' })
  @IsInt()
  itemId: number;

  @ApiProperty({ example: '2026-05-14T12:00:00.000Z' })
  @IsDateString()
  loanDate: string;

  @ApiProperty({ example: '2026-06-14T12:00:00.000Z' })
  @IsDateString()
  dueDate: string;

  @ApiProperty({ example: '2026-05-20T10:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  returnedAt?: string;

  @ApiProperty({ example: 'active', description: 'estado: active | returned | overdue' })
  @IsString()
  status: string;

  @ApiProperty({ example: '2026-05-14T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-05-15T12:00:00.000Z' })
  updatedAt: string;
}