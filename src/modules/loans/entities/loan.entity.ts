import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Item } from '@modules/items/entities/item.entity';
import { User } from '@modules/auth/entities/user.entity';

export enum LoanStatus {
  ACTIVE = 'active',
  RETURNED = 'returned',
  LOST = 'lost',
}

@Entity('loans')
export class Loan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'member_id' })
  member: User;

  @Column({ name: 'member_id' })
  memberId: string;

  @ManyToOne(() => Item, { nullable: false })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'item_id' })
  itemId: string;

  @Column({ type: 'timestamp' })
  loanedAt: Date;

  @Column({ type: 'timestamp' })
  dueAt: Date;

  @Column({ type: 'timestamp', nullable: true, default: null })
  returnedAt: Date | null;

  @Column({ type: 'enum', enum: LoanStatus, default: LoanStatus.ACTIVE })
  status: LoanStatus;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value ?? '0'),
    },
  })
  fineAmount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
