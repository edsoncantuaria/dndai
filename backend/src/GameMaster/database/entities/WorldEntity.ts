import {
    Entity,
    PrimaryColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import type { EntityTier } from './types/EntityTier.js';

export type WorldEntityType = 'hero' | 'npc' | 'monster' | 'faction' | 'item_legendary';

@Entity('world_entities')
@Index(['slug'], { unique: true })
@Index(['entityType'])
export class WorldEntity {
    @PrimaryColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 32 })
    entityType!: WorldEntityType;

    @Column({ type: 'boolean', default: true })
    canonical!: boolean;

    @Column({ type: 'varchar', length: 120 })
    slug!: string;

    @Column({ type: 'varchar', length: 160 })
    displayName!: string;

    @Column({ type: 'text', nullable: true })
    description!: string | null;

    @Column({ type: 'jsonb', default: {} })
    stats!: Record<string, unknown>;

    @Column({ type: 'jsonb', default: {} })
    personality!: Record<string, unknown>;

    @Column({ type: 'jsonb', default: {} })
    visual!: Record<string, unknown>;

    @Column({ type: 'uuid', nullable: true })
    poiId!: string | null;

    @Column({ type: 'int', nullable: true })
    createdByUserId!: number | null;

    @Column({ type: 'varchar', length: 32, default: 'ai_generated' })
    source!: 'ai_generated' | 'admin' | 'srd';

    @Column({ type: 'varchar', length: 16, default: 'pt-BR' })
    locale!: string;

    @Column({ type: 'varchar', length: 32, default: 'alive' })
    statusGlobal!: 'alive' | 'missing' | 'retired';

    @Column({ type: 'varchar', length: 16, default: 'INCIDENTAL' })
    entityTier!: EntityTier;

    @Column({ type: 'varchar', length: 64, nullable: true })
    embeddingPointId!: string | null;

    @Column({ type: 'boolean', default: false })
    isVaultTemplate!: boolean;

    @Column({ type: 'timestamp', nullable: true })
    deletedAt!: Date | null;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
