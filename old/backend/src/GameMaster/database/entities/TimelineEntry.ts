import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';

@Entity('timeline_entries')
@Index(['shardId', 'worldDay'])
@Index(['sessionId', 'worldDay'])
export class TimelineEntry {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid', nullable: true })
    shardId!: string | null;

    @Column({ type: 'int', nullable: true })
    sessionId!: number | null;

    @Column({ type: 'uuid' })
    eventId!: string;

    @Column({ type: 'varchar', length: 64 })
    eventType!: string;

    @Column({ type: 'int' })
    worldDay!: number;

    @Column({ type: 'int', default: 0 })
    worldHour!: number;

    @Column({ type: 'varchar', length: 48 })
    category!: string;

    @Column({ type: 'varchar', length: 320 })
    summary!: string;

    @CreateDateColumn()
    createdAt!: Date;
}
