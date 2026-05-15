import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { CreateReservationDto } from './dto/create-reservation.dto';
import { QueryReservationsDto } from './dto/query-reservations.dto';
import { ReservationsService } from './reservations.service';

@ApiTags('reservations')
@Controller('reservations')
@UseGuards(RolesGuard)
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @ApiOperation({ summary: 'Reserve an unavailable item (FIFO queue). Members reserve for themselves.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReservationDto) {
    return this.reservationsService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List reservations. Members see only their own. Supports filters: status, itemId, memberId.' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryReservationsDto) {
    return this.reservationsService.findAll(user, query);
  }

  @Patch('expire-ready')
  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Expire all overdue READY reservations and activate next in queue (admin, librarian)' })
  expireReady() {
    return this.reservationsService.expireReadyReservations();
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a reservation. Members can only cancel their own.' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reservationsService.cancel(id, user);
  }
}
