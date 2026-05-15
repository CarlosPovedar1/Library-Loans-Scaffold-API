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

export enum ReservationStatus {
  PENDING = 'pending',
  READY = 'ready',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

@Entity('reservations')
export class Reservation {
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

  @Column({ type: 'enum', enum: ReservationStatus, default: ReservationStatus.PENDING })
  status: ReservationStatus;

  @Column({ type: 'timestamp', nullable: true, default: null })
  readyAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  expiresAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  completedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  cancelledAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  expiredAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
