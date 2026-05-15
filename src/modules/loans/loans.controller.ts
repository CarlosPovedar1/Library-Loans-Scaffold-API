import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { RolesGuard } from '@common/guards/roles.guard';
import { UserRole } from '@modules/auth/entities/user.entity';
import { AuthenticatedUser } from '@modules/auth/strategies/jwt.strategy';
import { CreateLoanDto } from './dto/create-loan.dto';
import { QueryLoansDto } from './dto/query-loans.dto';
import { LoansService } from './loans.service';

@ApiTags('loans')
@Controller('loans')
@UseGuards(RolesGuard)
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  @ApiOperation({ summary: 'Create a loan. Members borrow for themselves; admin/librarian can specify memberId.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLoanDto) {
    return this.loansService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List loans. Members see only their own. Supports filters: status, overdue, memberId, itemId.' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryLoansDto) {
    return this.loansService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a loan by id. Members can only view their own.' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.loansService.findOne(id, user);
  }

  @Patch(':id/return')
  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN)
  @ApiOperation({ summary: 'Return a borrowed item and calculate fine (admin, librarian only)' })
  returnLoan(@Param('id', ParseUUIDPipe) id: string) {
    return this.loansService.returnLoan(id);
  }

  @Patch(':id/lost')
  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN)
  @ApiOperation({ summary: 'Mark a loan as lost — item also becomes lost (admin, librarian only)' })
  markAsLost(@Param('id', ParseUUIDPipe) id: string) {
    return this.loansService.markAsLost(id);
  }
}
