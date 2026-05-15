import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Item } from '@modules/items/entities/item.entity';
import { Reservation } from '@modules/reservations/entities/reservation.entity';
import { Loan } from './entities/loan.entity';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';

@Module({
  imports: [TypeOrmModule.forFeature([Loan, Item, Reservation])],
  controllers: [LoansController],
  providers: [LoansService],
})
export class LoansModule {}
