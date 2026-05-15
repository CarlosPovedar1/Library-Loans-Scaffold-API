import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Item } from '@modules/items/entities/item.entity';
import { UserRole } from '@modules/auth/entities/user.entity';
import { AuthenticatedUser } from '@modules/auth/strategies/jwt.strategy';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { Reservation, ReservationStatus } from './entities/reservation.entity';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
  ) {}

  async create(memberId: string, dto: CreateReservationDto): Promise<Reservation> {
    const item = await this.itemRepository.findOne({ where: { id: dto.itemId } });
    if (!item) throw new NotFoundException(`Item ${dto.itemId} not found`);

    if (item.isAvailable) {
      throw new BadRequestException(
        'Item is currently available — borrow it directly instead of reserving',
      );
    }

    const existing = await this.reservationRepository.findOne({
      where: {
        memberId,
        itemId: dto.itemId,
        status: In([ReservationStatus.PENDING, ReservationStatus.FULFILLED]),
      },
    });
    if (existing) {
      throw new ConflictException('You already have an active reservation for this item');
    }

    const reservation = this.reservationRepository.create({
      memberId,
      itemId: dto.itemId,
      status: ReservationStatus.PENDING,
    });
    return this.reservationRepository.save(reservation);
  }

  findAll(): Promise<Reservation[]> {
    return this.reservationRepository.find({
      relations: ['member', 'item'],
      order: { createdAt: 'ASC' },
    });
  }

  findByMember(memberId: string): Promise<Reservation[]> {
    return this.reservationRepository.find({
      where: { memberId },
      relations: ['item'],
      order: { createdAt: 'ASC' },
    });
  }

  findByItem(itemId: string): Promise<Reservation[]> {
    return this.reservationRepository.find({
      where: { itemId, status: In([ReservationStatus.PENDING, ReservationStatus.FULFILLED]) },
      relations: ['member'],
      order: { createdAt: 'ASC' },
    });
  }

  async cancel(id: string, requestingUser: AuthenticatedUser): Promise<Reservation> {
    const reservation = await this.reservationRepository.findOne({
      where: { id },
      relations: ['item'],
    });
    if (!reservation) throw new NotFoundException(`Reservation ${id} not found`);

    if (
      requestingUser.role === UserRole.MEMBER &&
      reservation.memberId !== requestingUser.id
    ) {
      throw new ForbiddenException('You can only cancel your own reservations');
    }

    if (
      reservation.status !== ReservationStatus.PENDING &&
      reservation.status !== ReservationStatus.FULFILLED
    ) {
      throw new BadRequestException(
        `Reservation cannot be cancelled (status: ${reservation.status})`,
      );
    }

    if (reservation.status === ReservationStatus.FULFILLED) {
      // Release item back to the next PENDING reservation or make it available
      await this.releaseItemAfterCancelledFulfilled(reservation.item, id);
    }

    reservation.status = ReservationStatus.CANCELLED;
    return this.reservationRepository.save(reservation);
  }

  private async releaseItemAfterCancelledFulfilled(item: Item, skipId: string): Promise<void> {
    const next = await this.reservationRepository.findOne({
      where: { itemId: item.id, status: ReservationStatus.PENDING },
      order: { createdAt: 'ASC' },
    });

    if (next && next.id !== skipId) {
      next.status = ReservationStatus.FULFILLED;
      next.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      await this.reservationRepository.save(next);
    } else {
      item.isAvailable = true;
      await this.itemRepository.save(item);
    }
  }
}
