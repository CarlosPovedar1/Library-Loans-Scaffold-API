import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { RolesGuard } from '@common/guards/roles.guard';
import { UserRole } from '@modules/auth/entities/user.entity';
import { AuthenticatedUser } from '@modules/auth/strategies/jwt.strategy';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationsService } from './reservations.service';

@ApiTags('reservations')
@Controller('reservations')
@UseGuards(RolesGuard)
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @Roles(UserRole.MEMBER, UserRole.ADMIN, UserRole.LIBRARIAN)
  @ApiOperation({ summary: 'Reserve an unavailable item (FIFO queue)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReservationDto) {
    return this.reservationsService.create(user.id, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN)
  @ApiOperation({ summary: 'List all reservations (admin, librarian)' })
  findAll() {
    return this.reservationsService.findAll();
  }

  @Get('my')
  @ApiOperation({ summary: 'List reservations for the current user' })
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.reservationsService.findByMember(user.id);
  }

  @Get('item/:itemId')
  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN)
  @ApiOperation({ summary: 'List pending/fulfilled reservations for an item (admin, librarian)' })
  findByItem(@Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.reservationsService.findByItem(itemId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a reservation' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reservationsService.cancel(id, user);
  }
}
