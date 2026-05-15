import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class CreateLoanDto {
  @ApiProperty({ example: 'a3b4c5d6-e7f8-9012-abcd-ef1234567890' })
  @IsUUID()
  itemId: string;

  @ApiPropertyOptional({
    example: 'b4c5d6e7-f809-1234-bcde-f12345678901',
    description: 'Target member ID. Admin/librarian only — ignored when caller is a member.',
  })
  @IsOptional()
  @IsUUID()
  memberId?: string;
}
