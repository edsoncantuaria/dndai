// backend/src/entities/RegionLink.ts
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

@Entity('region_links')
@Index(['fromRegionId', 'toRegionId'], { unique: true })
export class RegionLink {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  fromRegionId: number;

  @Column({ type: 'int' })
  toRegionId: number;

  @ManyToOne(() => Region, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fromRegionId' })
  fromRegion: Region;

  @ManyToOne(() => Region, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'toRegionId' })
  toRegion: Region;

  @Column({ type: 'varchar', length: 32, default: 'walk' })
  travelMode: 'walk' | 'mount' | 'airship' | 'portal' | 'ship' | 'teleport';

  @Column({ type: 'int', default: 0 })
  travelTimeMinutes: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  difficulty: string | null;

  @Column({ type: 'boolean', default: false })
  isLocked: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
