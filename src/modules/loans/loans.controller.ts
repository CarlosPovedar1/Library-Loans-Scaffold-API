import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { RolesGuard } from '@common/guards/roles.guard';
import { UserRole } from '@modules/auth/entities/user.entity';
import { AuthenticatedUser } from '@modules/auth/strategies/jwt.strategy';
import { CreateLoanDto } from './dto/create-loan.dto';
import { LoansService } from './loans.service';

@ApiTags('loans')
@Controller('loans')
@UseGuards(RolesGuard)
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  @ApiOperation({ summary: 'Borrow a library item' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLoanDto) {
    return this.loansService.create(user, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN)
  @ApiOperation({ summary: 'List all loans (admin, librarian)' })
  findAll() {
    return this.loansService.findAll();
  }

  @Get('my')
  @ApiOperation({ summary: 'List loans for the current authenticated user' })
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.loansService.findByUser(user.id);
  }

  @Get('overdue')
  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN)
  @ApiOperation({ summary: 'List all overdue active loans (admin, librarian)' })
  findOverdue() {
    return this.loansService.findOverdue();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a loan by id' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.loansService.findOne(id, user);
  }

  @Patch(':id/return')
  @ApiOperation({ summary: 'Return a borrowed item' })
  returnLoan(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.loansService.returnLoan(id, user);
  }

  @Patch(':id/lost')
  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN)
  @ApiOperation({ summary: 'Mark a loan item as lost (admin, librarian)' })
  markAsLost(@Param('id', ParseUUIDPipe) id: string) {
    return this.loansService.markAsLost(id);
  }
}
