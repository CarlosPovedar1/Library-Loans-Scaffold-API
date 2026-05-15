import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from '@modules/items/entities/item.entity';
import { UserRole } from '@modules/auth/entities/user.entity';
import { AuthenticatedUser } from '@modules/auth/strategies/jwt.strategy';
import { Reservation, ReservationStatus } from '@modules/reservations/entities/reservation.entity';
import { CreateLoanDto } from './dto/create-loan.dto';
import { Loan, LoanStatus } from './entities/loan.entity';

const RESERVATION_WINDOW_HOURS = 48;

@Injectable()
export class LoansService {
  constructor(
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    private readonly configService: ConfigService,
  ) {}

  async create(requestingUser: AuthenticatedUser, dto: CreateLoanDto): Promise<Loan> {
    const memberId =
      dto.memberId && requestingUser.role !== UserRole.MEMBER
        ? dto.memberId
        : requestingUser.id;

    const maxLoans = this.configService.get<number>('loans.maxActivePerUser') ?? 3;
    const maxDays = this.configService.get<number>('loans.maxLoanDays') ?? 30;

    const activeCount = await this.loanRepository.count({
      where: { memberId, status: LoanStatus.ACTIVE },
    });
    if (activeCount >= maxLoans) {
      throw new BadRequestException(`Member already has ${maxLoans} active loans`);
    }

    const item = await this.itemRepository.findOne({ where: { id: dto.itemId } });
    if (!item) throw new NotFoundException(`Item ${dto.itemId} not found`);

    // Check if there is a fulfilled (reserved) slot for this item
    const fulfilledReservation = await this.reservationRepository.findOne({
      where: { itemId: dto.itemId, status: ReservationStatus.FULFILLED },
    });

    if (fulfilledReservation) {
      if (new Date() > fulfilledReservation.expiresAt!) {
        // 48-h window expired — expire that reservation and release item
        fulfilledReservation.status = ReservationStatus.EXPIRED;
        await this.reservationRepository.save(fulfilledReservation);
        await this.releaseItemToNextReservation(item);

        // Re-fetch item state
        const refreshed = await this.itemRepository.findOne({ where: { id: dto.itemId } });
        if (!refreshed || !refreshed.isAvailable) {
          throw new BadRequestException('Item is reserved for another member');
        }
        Object.assign(item, refreshed);
      } else if (fulfilledReservation.memberId !== memberId) {
        throw new BadRequestException('Item is currently reserved for another member');
      } else {
        // Valid fulfilled reservation for this exact member — consume it
        fulfilledReservation.status = ReservationStatus.CANCELLED;
        await this.reservationRepository.save(fulfilledReservation);
      }
    } else if (!item.isAvailable) {
      throw new BadRequestException('Item is not available for loan');
    }

    item.isAvailable = false;
    await this.itemRepository.save(item);

    const loanedAt = new Date();
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + maxDays);

    const loan = this.loanRepository.create({
      memberId,
      itemId: dto.itemId,
      loanedAt,
      dueAt,
      status: LoanStatus.ACTIVE,
    });
    return this.loanRepository.save(loan);
  }

  findAll(): Promise<Loan[]> {
    return this.loanRepository.find({ relations: ['member', 'item'] });
  }

  findByUser(memberId: string): Promise<Loan[]> {
    return this.loanRepository.find({ where: { memberId }, relations: ['item'] });
  }

  findOverdue(): Promise<Loan[]> {
    return this.loanRepository
      .createQueryBuilder('loan')
      .leftJoinAndSelect('loan.member', 'member')
      .leftJoinAndSelect('loan.item', 'item')
      .where('loan.dueAt < :now', { now: new Date() })
      .andWhere('loan.status = :status', { status: LoanStatus.ACTIVE })
      .getMany();
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

  async returnLoan(id: string, requestingUser: AuthenticatedUser): Promise<Loan> {
    const loan = await this.loanRepository.findOne({
      where: { id },
      relations: ['item'],
    });
    if (!loan) throw new NotFoundException(`Loan ${id} not found`);
    if (requestingUser.role === UserRole.MEMBER && loan.memberId !== requestingUser.id) {
      throw new ForbiddenException('You can only return your own loans');
    }
    if (loan.status === LoanStatus.RETURNED) {
      throw new BadRequestException('Loan is already returned');
    }
    if (loan.status === LoanStatus.LOST) {
      throw new BadRequestException('Cannot return a loan marked as lost');
    }

    const now = new Date();
    loan.returnedAt = now;

    if (now > loan.dueAt) {
      const dailyRate = this.configService.get<number>('loans.dailyFineRate') ?? 0.5;
      const diffMs = now.getTime() - new Date(loan.dueAt).getTime();
      const overdueDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      loan.fineAmount = overdueDays * dailyRate;
      loan.status = LoanStatus.OVERDUE;
    } else {
      loan.status = LoanStatus.RETURNED;
    }

    await this.releaseItemToNextReservation(loan.item);
    return this.loanRepository.save(loan);
  }

  async markAsLost(id: string): Promise<Loan> {
    const loan = await this.loanRepository.findOne({
      where: { id },
      relations: ['item'],
    });
    if (!loan) throw new NotFoundException(`Loan ${id} not found`);
    if (loan.status === LoanStatus.RETURNED) {
      throw new BadRequestException('Cannot mark a returned loan as lost');
    }
    if (loan.status === LoanStatus.LOST) {
      throw new BadRequestException('Loan is already marked as lost');
    }

    loan.status = LoanStatus.LOST;
    loan.returnedAt = new Date();

    await this.releaseItemToNextReservation(loan.item);
    return this.loanRepository.save(loan);
  }

  private async releaseItemToNextReservation(item: Item): Promise<void> {
    const nextReservation = await this.reservationRepository.findOne({
      where: { itemId: item.id, status: ReservationStatus.PENDING },
      order: { createdAt: 'ASC' },
    });

    if (nextReservation) {
      nextReservation.status = ReservationStatus.FULFILLED;
      nextReservation.expiresAt = new Date(
        Date.now() + RESERVATION_WINDOW_HOURS * 60 * 60 * 1000,
      );
      await this.reservationRepository.save(nextReservation);
      // Item stays unavailable — it is now reserved for this member
    } else {
      item.isAvailable = true;
      await this.itemRepository.save(item);
    }
  }
}
