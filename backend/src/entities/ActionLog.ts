import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity('action_logs')
@Index(['sessionId', 'stateVersion'])
@Index(['sessionId', 'actionId'])
export class ActionLog {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    sessionId: number;

    @Column({ type: 'int', nullable: true })
    characterId?: number | null;

    @Column({ type: 'int', nullable: true })
    encounterId?: number | null;

    @Column({ type: 'varchar', length: 64, nullable: true })
    entityId?: string | null;

    @Column({ type: 'varchar', length: 64, nullable: true })
    actionId?: string | null;

    @Column({ type: 'varchar', length: 64, nullable: true })
    actionType?: string | null;

    @Column({ type: 'int', nullable: true })
    stateVersion?: number | null;

    @Column({ type: 'json', nullable: true })
    delta?: Record<string, any> | null;

    @Column({ type: 'json', nullable: true })
    metadata?: Record<string, any> | null;

    @CreateDateColumn()
    createdAt: Date;
}
