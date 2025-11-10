// backend/src/entities/RegionSnapshot.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('region_snapshots')
export class RegionSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 160 })
  label: string;

  @Column({ type: 'int', nullable: true })
  authorId: number | null;

  @Column({ type: 'json' })
  payload: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
