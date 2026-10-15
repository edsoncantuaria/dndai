import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';

@Entity('kg_edges')
@Index(['fromNodeId', 'toNodeId', 'relation'])
export class KgEdge {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    fromNodeId!: string;

    @Column({ type: 'uuid' })
    toNodeId!: string;

    @Column({ type: 'varchar', length: 48 })
    relation!: string;

    @Column({ type: 'int', default: 0 })
    strength!: number;

    @Column({ type: 'int', nullable: true })
    sinceWorldDay!: number | null;

    @Column({ type: 'uuid', nullable: true })
    sourceEventId!: string | null;

    @Column({ type: 'int', nullable: true })
    sessionId!: number | null;

    @CreateDateColumn()
    createdAt!: Date;
}
