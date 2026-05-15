import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoanStatus } from '../entities/loan.entity';

export class LoanDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  memberId: string;

  @ApiProperty()
  itemId: string;

  @ApiProperty()
  loanedAt: Date;

  @ApiProperty()
  dueAt: Date;

  @ApiPropertyOptional()
  returnedAt: Date | null;

  @ApiProperty({ enum: LoanStatus })
  status: LoanStatus;

  @ApiProperty()
  fineAmount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
