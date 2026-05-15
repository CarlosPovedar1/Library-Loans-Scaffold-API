import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { AuthenticatedUser } from '@modules/auth/strategies/jwt.strategy';
import { CreateLoanDto } from './dto/create-loan.dto';
import { LoansService } from './loans.service';

@ApiTags('loans')
@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  @ApiOperation({ summary: 'Borrow a library item' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLoanDto) {
    return this.loansService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all loans' })
  findAll() {
    return this.loansService.findAll();
  }

  @Get('my')
  @ApiOperation({ summary: 'List loans for the current user' })
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.loansService.findByUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a loan by id' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.loansService.findOne(id);
  }

  @Patch(':id/return')
  @ApiOperation({ summary: 'Return a borrowed item' })
  returnLoan(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.loansService.returnLoan(id, user.id);
  }
}
