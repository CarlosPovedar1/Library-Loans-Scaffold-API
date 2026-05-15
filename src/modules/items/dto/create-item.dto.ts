import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateItemDto {
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
  @Min(1)
  totalCopies: number;
}
