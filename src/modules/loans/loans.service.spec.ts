import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Item } from '@modules/items/entities/item.entity';
import { LoansService } from './loans.service';
import { Loan, LoanStatus } from './entities/loan.entity';

const mockLoanRepo = {
  count: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockItemRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) =>
    ({ 'loans.maxActivePerUser': 3, 'loans.maxLoanDays': 30, 'loans.dailyFineRate': 0.5 }[key]),
  ),
};

describe('LoansService', () => {
  let service: LoansService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoansService,
        { provide: getRepositoryToken(Loan), useValue: mockLoanRepo },
        { provide: getRepositoryToken(Item), useValue: mockItemRepo },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<LoansService>(LoansService);
    jest.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string) =>
      ({ 'loans.maxActivePerUser': 3, 'loans.maxLoanDays': 30, 'loans.dailyFineRate': 0.5 }[key]),
    );
  });

  describe('create', () => {
    it('should create a loan when all conditions are met', async () => {
      const item = { id: 'item1', availableCopies: 2 };
      const loan = { id: 'loan1', userId: 'user1', itemId: 'item1', status: LoanStatus.ACTIVE };
      mockLoanRepo.count.mockResolvedValue(1);
      mockItemRepo.findOne.mockResolvedValue(item);
      mockItemRepo.save.mockResolvedValue({ ...item, availableCopies: 1 });
      mockLoanRepo.create.mockReturnValue(loan);
      mockLoanRepo.save.mockResolvedValue(loan);

      const result = await service.create('user1', { itemId: 'item1' });

      expect(result).toEqual(loan);
      expect(mockItemRepo.save).toHaveBeenCalledWith({ ...item, availableCopies: 1 });
    });

    it('should throw BadRequestException when max active loans reached', async () => {
      mockLoanRepo.count.mockResolvedValue(3);

      await expect(service.create('user1', { itemId: 'item1' })).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when item does not exist', async () => {
      mockLoanRepo.count.mockResolvedValue(0);
      mockItemRepo.findOne.mockResolvedValue(null);

      await expect(service.create('user1', { itemId: 'ghost' })).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no copies available', async () => {
      mockLoanRepo.count.mockResolvedValue(0);
      mockItemRepo.findOne.mockResolvedValue({ id: 'item1', availableCopies: 0 });

      await expect(service.create('user1', { itemId: 'item1' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('returnLoan', () => {
    it('should mark loan as returned and increment available copies', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const loan = {
        id: 'loan1',
        userId: 'user1',
        status: LoanStatus.ACTIVE,
        dueDate: futureDate,
        fineAmount: 0,
        item: { id: 'item1', availableCopies: 0 },
      };
      mockLoanRepo.findOne.mockResolvedValue(loan);
      mockItemRepo.save.mockResolvedValue({ ...loan.item, availableCopies: 1 });
      mockLoanRepo.save.mockImplementation((l: Partial<Loan>) => Promise.resolve(l));

      const result = await service.returnLoan('loan1', 'user1');

      expect(result.status).toBe(LoanStatus.RETURNED);
      expect(result.returnDate).toBeDefined();
      expect(result.fineAmount).toBe(0);
    });

    it('should calculate fine when returned after due date', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const loan = {
        id: 'loan1',
        userId: 'user1',
        status: LoanStatus.ACTIVE,
        dueDate: pastDate,
        fineAmount: 0,
        item: { id: 'item1', availableCopies: 0 },
      };
      mockLoanRepo.findOne.mockResolvedValue(loan);
      mockItemRepo.save.mockResolvedValue({ ...loan.item, availableCopies: 1 });
      mockLoanRepo.save.mockImplementation((l: Partial<Loan>) => Promise.resolve(l));

      const result = await service.returnLoan('loan1', 'user1');

      expect(result.fineAmount).toBeGreaterThan(0);
    });

    it('should throw NotFoundException when loan not found for user', async () => {
      mockLoanRepo.findOne.mockResolvedValue(null);

      await expect(service.returnLoan('ghost', 'user1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when loan already returned', async () => {
      mockLoanRepo.findOne.mockResolvedValue({
        id: 'loan1',
        userId: 'user1',
        status: LoanStatus.RETURNED,
        item: { id: 'item1' },
      });

      await expect(service.returnLoan('loan1', 'user1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all loans with relations', async () => {
      const loans = [{ id: 'l1' }, { id: 'l2' }];
      mockLoanRepo.find.mockResolvedValue(loans);

      const result = await service.findAll();

      expect(result).toEqual(loans);
      expect(mockLoanRepo.find).toHaveBeenCalledWith({ relations: ['user', 'item'] });
    });
  });

  describe('findByUser', () => {
    it('should return loans filtered by userId', async () => {
      const loans = [{ id: 'l1', userId: 'user1' }];
      mockLoanRepo.find.mockResolvedValue(loans);

      const result = await service.findByUser('user1');

      expect(result).toEqual(loans);
    });
  });

  describe('findOne', () => {
    it('should return a loan by id', async () => {
      const loan = { id: 'l1' };
      mockLoanRepo.findOne.mockResolvedValue(loan);

      const result = await service.findOne('l1');

      expect(result).toEqual(loan);
    });

    it('should throw NotFoundException when loan does not exist', async () => {
      mockLoanRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('ghost')).rejects.toThrow(NotFoundException);
    });
  });
});
