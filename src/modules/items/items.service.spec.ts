import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ItemsService } from './items.service';
import { Item } from './entities/item.entity';

const mockItemRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

describe('ItemsService', () => {
  let service: ItemsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItemsService,
        { provide: getRepositoryToken(Item), useValue: mockItemRepo },
      ],
    }).compile();

    service = module.get<ItemsService>(ItemsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto = { title: 'Clean Code', author: 'Robert Martin', isbn: '978-0132350884', totalCopies: 3 };

    it('should create and return a new item', async () => {
      const item = { ...dto, id: 'i1', availableCopies: 3 };
      mockItemRepo.findOne.mockResolvedValue(null);
      mockItemRepo.create.mockReturnValue(item);
      mockItemRepo.save.mockResolvedValue(item);

      const result = await service.create(dto);

      expect(result).toEqual(item);
      expect(mockItemRepo.create).toHaveBeenCalledWith({ ...dto, availableCopies: dto.totalCopies });
    });

    it('should throw ConflictException when ISBN already exists', async () => {
      mockItemRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all items', async () => {
      const items = [{ id: 'i1' }, { id: 'i2' }];
      mockItemRepo.find.mockResolvedValue(items);

      const result = await service.findAll();

      expect(result).toEqual(items);
      expect(mockItemRepo.find).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return an item by id', async () => {
      const item = { id: 'i1', title: 'Clean Code' };
      mockItemRepo.findOne.mockResolvedValue(item);

      const result = await service.findOne('i1');

      expect(result).toEqual(item);
    });

    it('should throw NotFoundException when item does not exist', async () => {
      mockItemRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return the item', async () => {
      const item = { id: 'i1', title: 'Old Title', author: 'Author', isbn: '123', totalCopies: 1, availableCopies: 1 };
      const updated = { ...item, title: 'New Title' };
      mockItemRepo.findOne.mockResolvedValue(item);
      mockItemRepo.save.mockResolvedValue(updated);

      const result = await service.update('i1', { title: 'New Title' });

      expect(result.title).toBe('New Title');
    });

    it('should throw NotFoundException when item does not exist', async () => {
      mockItemRepo.findOne.mockResolvedValue(null);

      await expect(service.update('ghost', { title: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove the item', async () => {
      const item = { id: 'i1' };
      mockItemRepo.findOne.mockResolvedValue(item);
      mockItemRepo.remove.mockResolvedValue(undefined);

      await service.remove('i1');

      expect(mockItemRepo.remove).toHaveBeenCalledWith(item);
    });

    it('should throw NotFoundException when item does not exist', async () => {
      mockItemRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('ghost')).rejects.toThrow(NotFoundException);
    });
  });
});
