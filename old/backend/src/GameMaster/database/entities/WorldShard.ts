import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

/** Região compartilhada entre campanhas (fase P12). */
@Entity('world_shards')
@Index(['regionSlug'], { unique: true })
export class WorldShard {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 64 })
    regionSlug!: string;

    @Column({ type: 'varchar', length: 120 })
    displayName!: string;

    @Column({ type: 'int', default: 0 })
    version!: number;

    @Column({ type: 'varchar', length: 24, default: 'stable' })
    politicsState!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
