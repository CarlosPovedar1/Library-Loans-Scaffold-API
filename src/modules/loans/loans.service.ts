import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item, ItemStatus } from '@modules/items/entities/item.entity';
import { User, UserRole } from '@modules/auth/entities/user.entity';
import { AuthenticatedUser } from '@modules/auth/strategies/jwt.strategy';
import { Reservation, ReservationStatus } from '@modules/reservations/entities/reservation.entity';
import { CreateLoanDto } from './dto/create-loan.dto';
import { QueryLoansDto } from './dto/query-loans.dto';
import { Loan, LoanStatus } from './entities/loan.entity';

const RESERVATION_WINDOW_MS = 48 * 60 * 60 * 1000;

@Injectable()
export class LoansService {
  constructor(
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    private readonly configService: ConfigService,
  ) {}

  async create(requestingUser: AuthenticatedUser, dto: CreateLoanDto): Promise<Loan> {
    const memberId =
      dto.memberId && requestingUser.role !== UserRole.MEMBER
        ? dto.memberId
        : requestingUser.id;

    const member = await this.userRepository.findOne({ where: { id: memberId } });
    if (!member) throw new NotFoundException(`User ${memberId} not found`);
    if (member.role !== UserRole.MEMBER) {
      throw new BadRequestException('Only users with role "member" can borrow items');
    }

    const dueAt = new Date(dto.dueAt);
    if (dueAt <= new Date()) {
      throw new BadRequestException('dueAt must be a future datetime');
    }

    const maxActive = this.configService.get<number>('loans.maxActivePerUser') ?? 3;
    const activeCount = await this.loanRepository.count({
      where: { memberId, status: LoanStatus.ACTIVE },
    });
    if (activeCount >= maxActive) {
      throw new ConflictException(
        `Member already has ${maxActive} active loans — must return one before borrowing`,
      );
    }

    const item = await this.itemRepository.findOne({ where: { id: dto.itemId } });
    if (!item) throw new NotFoundException(`Item ${dto.itemId} not found`);

    if (item.status === ItemStatus.LOST || item.status === ItemStatus.INACTIVE) {
      throw new BadRequestException(`Item cannot be borrowed (status: ${item.status})`);
    }
    if (item.status === ItemStatus.BORROWED) {
      throw new ConflictException('Item is already borrowed');
    }

    if (item.status === ItemStatus.AVAILABLE) {
      const queued = await this.reservationRepository.findOne({
        where: [
          { itemId: dto.itemId, status: ReservationStatus.PENDING },
          { itemId: dto.itemId, status: ReservationStatus.READY },
        ],
      });
      if (queued) {
        throw new BadRequestException(
          'Item has reservations in the queue — you must reserve it instead of borrowing directly',
        );
      }
    }

    if (item.status === ItemStatus.RESERVED) {
      const readyReservation = await this.reservationRepository.findOne({
        where: { itemId: dto.itemId, status: ReservationStatus.READY },
      });

      if (!readyReservation) {
        throw new BadRequestException('Item is reserved but no ready reservation found');
      }
      if (readyReservation.memberId !== memberId) {
        throw new ForbiddenException('Item is currently reserved for a different member');
      }
      if (readyReservation.expiresAt && new Date() > readyReservation.expiresAt) {
        readyReservation.status = ReservationStatus.EXPIRED;
        readyReservation.expiredAt = new Date();
        await this.reservationRepository.save(readyReservation);
        await this.activateNextReservation(item);
        throw new BadRequestException('Your reservation window has expired');
      }

      readyReservation.status = ReservationStatus.COMPLETED;
      readyReservation.completedAt = new Date();
      await this.reservationRepository.save(readyReservation);
    }

    item.status = ItemStatus.BORROWED;
    await this.itemRepository.save(item);

    const loan = this.loanRepository.create({
      memberId,
      itemId: dto.itemId,
      loanedAt: new Date(),
      dueAt,
      status: LoanStatus.ACTIVE,
      fineAmount: 0,
    });
    return this.loanRepository.save(loan);
  }

  findAll(requestingUser: AuthenticatedUser, query: QueryLoansDto): Promise<Loan[]> {
    const qb = this.loanRepository
      .createQueryBuilder('loan')
      .leftJoinAndSelect('loan.member', 'member')
      .leftJoinAndSelect('loan.item', 'item');

    if (requestingUser.role === UserRole.MEMBER) {
      qb.andWhere('loan.memberId = :memberId', { memberId: requestingUser.id });
    } else if (query.memberId) {
      qb.andWhere('loan.memberId = :memberId', { memberId: query.memberId });
    }

    if (query.overdue) {
      qb.andWhere('loan.status = :status', { status: LoanStatus.ACTIVE });
      qb.andWhere('loan.dueAt < :now', { now: new Date() });
    } else if (query.status) {
      qb.andWhere('loan.status = :status', { status: query.status });
    }

    if (query.itemId) {
      qb.andWhere('loan.itemId = :itemId', { itemId: query.itemId });
    }

    return qb.orderBy('loan.createdAt', 'DESC').getMany();
  }

  async findOne(id: string, requestingUser: AuthenticatedUser): Promise<Loan> {
    const loan = await this.loanRepository.findOne({
      where: { id },
      relations: ['member', 'item'],
    });
    if (!loan) throw new NotFoundException(`Loan ${id} not found`);
    if (requestingUser.role === UserRole.MEMBER && loan.memberId !== requestingUser.id) {
      throw new ForbiddenException('You can only view your own loans');
    }
    return loan;
  }

  async returnLoan(id: string): Promise<Loan> {
    const loan = await this.loanRepository.findOne({
      where: { id },
      relations: ['item'],
    });
    if (!loan) throw new NotFoundException(`Loan ${id} not found`);
    if (loan.status !== LoanStatus.ACTIVE) {
      throw new BadRequestException(`Cannot return a loan with status: ${loan.status}`);
    }

    const now = new Date();
    loan.returnedAt = now;
    loan.status = LoanStatus.RETURNED;

    if (now > new Date(loan.dueAt)) {
      const daysLate = Math.ceil(
        (now.getTime() - new Date(loan.dueAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      const dailyFineRate = this.configService.get<number>('loans.dailyFineRate') ?? 0.5;
      loan.fineAmount = daysLate * dailyFineRate;
    } else {
      loan.fineAmount = 0;
    }

    await this.loanRepository.save(loan);
    await this.activateNextReservation(loan.item);

    return loan;
  }

  async markAsLost(id: string): Promise<Loan> {
    const loan = await this.loanRepository.findOne({
      where: { id },
      relations: ['item'],
    });
    if (!loan) throw new NotFoundException(`Loan ${id} not found`);
    if (loan.status !== LoanStatus.ACTIVE) {
      throw new BadRequestException(`Cannot mark as lost a loan with status: ${loan.status}`);
    }

    loan.status = LoanStatus.LOST;
    await this.loanRepository.save(loan);

    loan.item.status = ItemStatus.LOST;
    await this.itemRepository.save(loan.item);

    return loan;
  }

  private async activateNextReservation(item: Item): Promise<void> {
    const next = await this.reservationRepository.findOne({
      where: { itemId: item.id, status: ReservationStatus.PENDING },
      order: { createdAt: 'ASC' },
    });

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
