import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('world_events')
@Index(['sessionId', 'createdAt'])
export class WorldEvent {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 64 })
    type!: string;

    @Column({ type: 'int', nullable: true })
    sessionId!: number | null;

    @Column({ type: 'uuid', nullable: true })
    actorEntityId!: string | null;

    @Column({ type: 'jsonb', default: {} })
    payload!: Record<string, unknown>;

    @Column({ type: 'boolean', default: false })
    canonCandidate!: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;
}
