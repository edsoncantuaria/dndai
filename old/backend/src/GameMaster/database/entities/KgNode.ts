import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';

@Entity('kg_nodes')
@Index(['shardId', 'nodeType', 'slug'])
export class KgNode {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid', nullable: true })
    shardId!: string | null;

    @Column({ type: 'varchar', length: 32 })
    nodeType!: string;

    @Column({ type: 'varchar', length: 96 })
    slug!: string;

    @Column({ type: 'varchar', length: 160 })
    displayName!: string;

    @CreateDateColumn()
    createdAt!: Date;
}
