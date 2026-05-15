import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { ItemStatus, ItemType } from '../entities/item.entity';

export class UpdateItemDto {
  @ApiPropertyOptional({ example: 'BK-0099' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]([A-Z0-9-]*[A-Z0-9])?$/, {
    message: 'code must be uppercase alphanumeric with optional dashes',
  })
  code?: string;

  @ApiPropertyOptional({ example: 'The Pragmatic Programmer' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @ApiPropertyOptional({ enum: ItemType })
  @IsOptional()
  @IsEnum(ItemType)
  type?: ItemType;

  @ApiPropertyOptional({ enum: ItemStatus })
  @IsOptional()
  @IsEnum(ItemStatus)
  status?: ItemStatus;
}
