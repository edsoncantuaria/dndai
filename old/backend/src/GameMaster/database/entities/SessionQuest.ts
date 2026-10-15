import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity('session_quests')
@Index(['sessionId', 'questSlug'], { unique: true })
export class SessionQuest {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'int' })
    sessionId!: number;

    @Column({ type: 'varchar', length: 64 })
    questSlug!: string;

    @Column({ type: 'varchar', length: 160 })
    title!: string;

    @Column({ type: 'varchar', length: 32, default: 'active' })
    status!: 'active' | 'completed' | 'failed';

    @Column({ type: 'int', default: 0 })
    stage!: number;

    @Column({ type: 'jsonb', default: {} })
    payload!: Record<string, unknown>;

    @CreateDateColumn({ type: 'timestamptz' })
    startedAt!: Date;

    @Column({ type: 'timestamptz', nullable: true })
    advancedAt!: Date | null;
}
