import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item, ItemStatus } from '@modules/items/entities/item.entity';
import { User, UserRole } from '@modules/auth/entities/user.entity';
import { AuthenticatedUser } from '@modules/auth/strategies/jwt.strategy';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { QueryReservationsDto } from './dto/query-reservations.dto';
import { Reservation, ReservationStatus } from './entities/reservation.entity';

const RESERVATION_WINDOW_MS = 48 * 60 * 60 * 1000;

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(requestingUser: AuthenticatedUser, dto: CreateReservationDto): Promise<Reservation> {
    const memberId =
      dto.memberId && requestingUser.role !== UserRole.MEMBER
        ? dto.memberId
        : requestingUser.id;

    // Validate target member exists and has role 'member'
    const member = await this.userRepository.findOne({ where: { id: memberId } });
    if (!member) throw new NotFoundException(`User ${memberId} not found`);
    if (member.role !== UserRole.MEMBER) {
      throw new BadRequestException('Only users with role "member" can make reservations');
    }

    // Validate item
    const item = await this.itemRepository.findOne({ where: { id: dto.itemId } });
    if (!item) throw new NotFoundException(`Item ${dto.itemId} not found`);

    if (item.status === ItemStatus.AVAILABLE) {
      throw new BadRequestException(
        'Item is currently available — borrow it directly instead of reserving',
      );
    }
    if (item.status === ItemStatus.LOST) {
      throw new BadRequestException('Cannot reserve a lost item');
    }
    if (item.status === ItemStatus.INACTIVE) {
      throw new BadRequestException('Cannot reserve an inactive item');
    }
    // Only BORROWED and RESERVED items can be reserved
    if (item.status !== ItemStatus.BORROWED && item.status !== ItemStatus.RESERVED) {
      throw new BadRequestException(`Cannot reserve item with status: ${item.status}`);
    }

    // Reject duplicate active reservation for same member+item
    const existing = await this.reservationRepository.findOne({
      where: [
        { memberId, itemId: dto.itemId, status: ReservationStatus.PENDING },
        { memberId, itemId: dto.itemId, status: ReservationStatus.READY },
      ],
    });
    if (existing) {
      throw new ConflictException('You already have an active reservation for this item');
    }

    const reservation = this.reservationRepository.create({
      memberId,
      itemId: dto.itemId,
      status: ReservationStatus.PENDING,
      readyAt: null,
      expiresAt: null,
    });
    return this.reservationRepository.save(reservation);
  }

  findAll(requestingUser: AuthenticatedUser, query: QueryReservationsDto): Promise<Reservation[]> {
    const qb = this.reservationRepository
      .createQueryBuilder('reservation')
      .leftJoinAndSelect('reservation.member', 'member')
      .leftJoinAndSelect('reservation.item', 'item');

    // Members only see their own reservations
    if (requestingUser.role === UserRole.MEMBER) {
      qb.andWhere('reservation.memberId = :memberId', { memberId: requestingUser.id });
    } else if (query.memberId) {
      qb.andWhere('reservation.memberId = :memberId', { memberId: query.memberId });
    }

    if (query.status) {
      qb.andWhere('reservation.status = :status', { status: query.status });
    }
    if (query.itemId) {
      qb.andWhere('reservation.itemId = :itemId', { itemId: query.itemId });
    }

    return qb.orderBy('reservation.createdAt', 'ASC').getMany();
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
      reservation.status !== ReservationStatus.READY
    ) {
      throw new BadRequestException(
        `Cannot cancel a reservation with status: ${reservation.status}`,
      );
    }

    const wasReady = reservation.status === ReservationStatus.READY;

    reservation.status = ReservationStatus.CANCELLED;
    await this.reservationRepository.save(reservation);

    // If the cancelled reservation was READY, activate the next one in the FIFO queue
    if (wasReady) {
      await this.activateNextReservation(reservation.item, id);
    }

    return reservation;
  }

  async expireReadyReservations(): Promise<{ expired: number }> {
    const now = new Date();

    const overdueReady = await this.reservationRepository
      .createQueryBuilder('reservation')
      .leftJoinAndSelect('reservation.item', 'item')
      .where('reservation.status = :status', { status: ReservationStatus.READY })
      .andWhere('reservation.expiresAt < :now', { now })
      .getMany();

    for (const reservation of overdueReady) {
      reservation.status = ReservationStatus.EXPIRED;
      await this.reservationRepository.save(reservation);
      await this.activateNextReservation(reservation.item, reservation.id);
    }

    return { expired: overdueReady.length };
  }

  private async activateNextReservation(item: Item, skipId: string): Promise<void> {
    const next = await this.reservationRepository
      .createQueryBuilder('reservation')
      .where('reservation.itemId = :itemId', { itemId: item.id })
      .andWhere('reservation.status = :status', { status: ReservationStatus.PENDING })
      .andWhere('reservation.id != :skipId', { skipId })
      .orderBy('reservation.createdAt', 'ASC')
      .getOne();

    if (next) {
      next.status = ReservationStatus.READY;
      next.readyAt = new Date();
      next.expiresAt = new Date(Date.now() + RESERVATION_WINDOW_MS);
      await this.reservationRepository.save(next);
      item.status = ItemStatus.RESERVED;
    } else {
      item.status = ItemStatus.AVAILABLE;
    }
    await this.itemRepository.save(item);
  }
}
