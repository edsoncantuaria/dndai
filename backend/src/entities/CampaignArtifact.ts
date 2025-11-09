// backend/src/entities/CampaignArtifact.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('campaign_artifacts')
@Index(['characterId', 'slug'], { unique: true })
export class CampaignArtifact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  characterId: number;

  @Column({ type: 'int', nullable: true })
  sessionId: number | null;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 160 })
  slug: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  rarity: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  originLabel: string | null;

  @Column({ type: 'varchar', length: 32, default: 'loot' })
  sourceType: 'loot' | 'fallback' | 'manual';

  @Column({ type: 'varchar', length: 120, nullable: true })
  regionSlug: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  pointOfInterestSlug: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'json', nullable: true })
  keywords: string[] | null;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
