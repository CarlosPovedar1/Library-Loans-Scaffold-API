import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Matches, MinLength } from 'class-validator';
import { ItemType } from '../entities/item.entity';

export class CreateItemDto {
  @ApiProperty({ example: 'BK-0042', description: 'Unique item code, e.g. BK-0042 or EQ-LAB-007' })
  @IsString()
  @Matches(/^[A-Z0-9]([A-Z0-9-]*[A-Z0-9])?$/, {
    message: 'code must be uppercase alphanumeric with optional dashes (e.g. BK-0042)',
  })
  code: string;

  @ApiProperty({ example: 'Clean Code' })
  @IsString()
  @MinLength(1)
  title: string;

  @ApiProperty({ enum: ItemType, example: ItemType.BOOK })
  @IsEnum(ItemType)
  type: ItemType;
}
