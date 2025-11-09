// backend/src/entities/Region.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { RegionPointOfInterest } from './RegionPointOfInterest.js';

@Entity('regions')
export class Region {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 120 })
  slug: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 240, nullable: true })
  summary: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 32 })
  type: 'world' | 'city' | 'dungeon' | 'wild' | 'instance';

  @Column({ type: 'boolean', default: false })
  isSpawnPool: boolean;

  @Column({ type: 'int', nullable: true })
  parentRegionId: number | null;

  @ManyToOne(() => Region, region => region.children, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parentRegionId' })
  parent?: Region | null;

  @OneToMany(() => Region, region => region.parent)
  children?: Region[];

  @OneToMany(() => RegionPointOfInterest, poi => poi.region)
  pointsOfInterest?: RegionPointOfInterest[];

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
