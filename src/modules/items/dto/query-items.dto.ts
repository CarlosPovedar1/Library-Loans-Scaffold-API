import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ItemStatus, ItemType } from '../entities/item.entity';

export class QueryItemsDto {
  @ApiPropertyOptional({ enum: ItemType, description: 'Filter by item type' })
  @IsOptional()
  @IsEnum(ItemType)
  type?: ItemType;

  @ApiPropertyOptional({ enum: ItemStatus, description: 'Filter by item status' })
  @IsOptional()
  @IsEnum(ItemStatus)
  status?: ItemStatus;

  @ApiPropertyOptional({ description: 'Case-insensitive search on title or code' })
  @IsOptional()
  @IsString()
  search?: string;
}
