import { ApiProperty } from '@nestjs/swagger';
import { ItemType } from '../entities/item.entity';

export class ItemDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'BK-0042' })
  code: string;

  @ApiProperty({ example: 'Clean Code' })
  title: string;

  @ApiProperty({ enum: ItemType })
  type: ItemType;

  @ApiProperty()
  isAvailable: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
