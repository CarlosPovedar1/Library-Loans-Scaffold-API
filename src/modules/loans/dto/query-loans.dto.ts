import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { LoanStatus } from '../entities/loan.entity';

export class QueryLoansDto {
  @ApiPropertyOptional({ enum: LoanStatus, description: 'Filter by loan status' })
  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;

  @ApiPropertyOptional({
    description: 'When true, returns only active loans past their due date',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional({ description: 'Filter by member ID (admin/librarian only)' })
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiPropertyOptional({ description: 'Filter by item ID' })
  @IsOptional()
  @IsUUID()
  itemId?: string;
}
