import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ReservationStatus } from '../entities/reservation.entity';

export class QueryReservationsDto {
  @ApiPropertyOptional({ enum: ReservationStatus, description: 'Filter by reservation status' })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @ApiPropertyOptional({ description: 'Filter by item ID' })
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiPropertyOptional({ description: 'Filter by member ID (admin/librarian only)' })
  @IsOptional()
  @IsUUID()
  memberId?: string;
}
