import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('session_region_state')
@Index(['sessionId', 'regionSlug'], { unique: true })
export class SessionRegionState {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int' })
    sessionId!: number;

    @Column({ type: 'varchar', length: 64 })
    regionSlug!: string;

    @Column({ type: 'int', default: 20 })
    fear!: number;

    @Column({ type: 'int', default: 50 })
    prosperity!: number;

    @Column({ type: 'int', default: 30 })
    crime!: number;

    @Column({ type: 'jsonb', default: {} })
    resources!: Record<string, number>;

    @Column({ type: 'timestamptz', default: () => 'NOW()' })
    updatedAt!: Date;
}
