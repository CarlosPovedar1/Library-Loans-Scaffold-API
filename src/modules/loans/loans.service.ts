import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from '@modules/items/entities/item.entity';
import { CreateLoanDto } from './dto/create-loan.dto';
import { Loan, LoanStatus } from './entities/loan.entity';

@Injectable()
export class LoansService {
  constructor(
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    private readonly configService: ConfigService,
  ) {}

  async create(userId: string, dto: CreateLoanDto): Promise<Loan> {
    const maxLoans = this.configService.get<number>('loans.maxActivePerUser') ?? 3;
    const maxDays = this.configService.get<number>('loans.maxLoanDays') ?? 30;

    const activeCount = await this.loanRepository.count({
      where: { userId, status: LoanStatus.ACTIVE },
    });
    if (activeCount >= maxLoans) {
      throw new BadRequestException(`User already has ${maxLoans} active loans`);
    }

    const item = await this.itemRepository.findOne({ where: { id: dto.itemId } });
    if (!item) throw new NotFoundException(`Item ${dto.itemId} not found`);
    if (item.availableCopies < 1) {
      throw new BadRequestException('No copies available for this item');
    }

    item.availableCopies -= 1;
    await this.itemRepository.save(item);

    const loanDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + maxDays);

    const loan = this.loanRepository.create({
      userId,
      itemId: dto.itemId,
      loanDate,
      dueDate,
      status: LoanStatus.ACTIVE,
    });
    return this.loanRepository.save(loan);
  }

  findAll(): Promise<Loan[]> {
    return this.loanRepository.find({ relations: ['user', 'item'] });
  }

  findByUser(userId: string): Promise<Loan[]> {
    return this.loanRepository.find({ where: { userId }, relations: ['item'] });
  }

  async findOne(id: string): Promise<Loan> {
    const loan = await this.loanRepository.findOne({
      where: { id },
      relations: ['user', 'item'],
    });
    if (!loan) throw new NotFoundException(`Loan ${id} not found`);
    return loan;
  }

  async returnLoan(id: string, userId: string): Promise<Loan> {
    const loan = await this.loanRepository.findOne({
      where: { id, userId },
      relations: ['item'],
    });
    if (!loan) throw new NotFoundException(`Loan ${id} not found for this user`);
    if (loan.status === LoanStatus.RETURNED) {
      throw new BadRequestException('Loan already returned');
    }

    const now = new Date();
    loan.returnDate = now;
    loan.status = LoanStatus.RETURNED;

    if (now > loan.dueDate) {
      const dailyRate = this.configService.get<number>('loans.dailyFineRate') ?? 0.5;
      const diffMs = now.getTime() - new Date(loan.dueDate).getTime();
      const overdueDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      loan.fineAmount = overdueDays * dailyRate;
    }

    loan.item.availableCopies += 1;
    await this.itemRepository.save(loan.item);

    return this.loanRepository.save(loan);
  }
}
