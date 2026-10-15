import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    Index,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { GameSession } from './GameSession.js';
import { WorldEntity } from './WorldEntity.js';

@Entity('hero_inventory_items')
@Index(['sessionId', 'heroEntityId', 'itemKey'], { unique: true })
export class HeroInventoryItem {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'int' })
    sessionId!: number;

    @ManyToOne(() => GameSession, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sessionId' })
    session!: GameSession;

    @Column({ type: 'uuid' })
    heroEntityId!: string;

    @ManyToOne(() => WorldEntity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'heroEntityId' })
    hero!: WorldEntity;

    @Column({ type: 'varchar', length: 64 })
    itemKey!: string;

    @Column({ type: 'varchar', length: 120 })
    name!: string;

    @Column({ type: 'int', default: 1 })
    quantity!: number;

    @Column({ type: 'boolean', default: false })
    equipped!: boolean;

    @Column({ type: 'jsonb', default: {} })
    itemData!: Record<string, unknown>;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
