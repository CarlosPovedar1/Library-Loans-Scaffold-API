import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({ example: 'a3b4c5d6-e7f8-9012-abcd-ef1234567890' })
  @IsUUID()
  itemId: string;
}
