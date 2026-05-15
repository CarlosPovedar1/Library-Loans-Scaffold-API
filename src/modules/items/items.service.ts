import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Loan, LoanStatus } from '@modules/loans/entities/loan.entity';
import { CreateItemDto } from './dto/create-item.dto';
import { QueryItemsDto } from './dto/query-items.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { Item, ItemStatus } from './entities/item.entity';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
  ) {}

  async create(dto: CreateItemDto): Promise<Item> {
    const existing = await this.itemRepository.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Item code ${dto.code} already exists`);
    }
    const item = this.itemRepository.create(dto);
    return this.itemRepository.save(item);
  }

  findAll(query: QueryItemsDto): Promise<Item[]> {
    const qb = this.itemRepository.createQueryBuilder('item');

    if (query.type) {
      qb.andWhere('item.type = :type', { type: query.type });
    }
    if (query.status) {
      qb.andWhere('item.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        '(LOWER(item.title) LIKE :search OR LOWER(item.code) LIKE :search)',
        { search: `%${query.search.toLowerCase()}%` },
      );
    }

    return qb.orderBy('item.createdAt', 'DESC').getMany();
  }

  async findOne(id: string): Promise<Item> {
    const item = await this.itemRepository.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Item ${id} not found`);
    return item;
  }

  async update(id: string, dto: UpdateItemDto): Promise<Item> {
    const item = await this.findOne(id);

    if (dto.status === ItemStatus.AVAILABLE || dto.status === ItemStatus.INACTIVE) {
      const activeLoan = await this.loanRepository.findOne({
        where: { itemId: id, status: LoanStatus.ACTIVE },
      });
      if (activeLoan) {
        throw new BadRequestException(
          `Cannot set status to '${dto.status}' while item has an active loan`,
        );
      }
    }

    if (dto.code && dto.code !== item.code) {
      const conflict = await this.itemRepository.findOne({ where: { code: dto.code } });
      if (conflict) throw new ConflictException(`Item code ${dto.code} already exists`);
    }

    Object.assign(item, dto);
    return this.itemRepository.save(item);
  }

  async remove(id: string): Promise<void> {
    const item = await this.findOne(id);

    const activeLoan = await this.loanRepository.findOne({
      where: { itemId: id, status: LoanStatus.ACTIVE },
    });
    if (activeLoan) {
      throw new BadRequestException('Cannot deactivate an item with an active loan');
    }

    item.status = ItemStatus.INACTIVE;
    await this.itemRepository.save(item);
  }
}
