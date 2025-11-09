// backend/src/entities/RegionPointOfInterest.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Region } from './Region.js';

@Entity('region_points_of_interest')
@Index(['regionId', 'slug'], { unique: true })
export class RegionPointOfInterest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  regionId: number;

  @ManyToOne(() => Region, region => region.pointsOfInterest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'regionId' })
  region: Region;

  @Column({ type: 'varchar', length: 120 })
  slug: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 32, default: 'landmark' })
  type: 'landmark' | 'dungeon' | 'shop' | 'story' | 'wild' | 'instance' | 'misc';

  @Column({ type: 'varchar', length: 240, nullable: true })
  summary: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'boolean', default: false })
  isLocked: boolean;

  @Column({ type: 'boolean', default: true })
  allowAiExpansion: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
