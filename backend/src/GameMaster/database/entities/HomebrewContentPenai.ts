import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
    OneToMany,
} from 'typeorm';

export type PenaiHomebrewContentType =
    | 'race'
    | 'subrace'
    | 'class'
    | 'subclass'
    | 'spell'
    | 'item'
    | 'monster'
    | 'background'
    | 'feat'
    | 'skill'
    | 'translation';

export type PenaiHomebrewSourceKind = 'original' | 'translation' | 'fork';

@Entity('penai_homebrew_content')
export class PenaiHomebrewContent {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'int' })
    authorId!: number;

    @Index()
    @Column({ type: 'varchar', length: 32 })
    type!: PenaiHomebrewContentType;

    @Column({ type: 'varchar', length: 255 })
    name!: string;

    @Column({ type: 'jsonb' })
    content!: Record<string, unknown>;

    @Index()
    @Column({ type: 'boolean', default: false })
    isPublic!: boolean;

    @Column({ type: 'varchar', length: 8, default: 'user' })
    createdBy!: 'user' | 'ai';

    @Column({ type: 'simple-array', nullable: true })
    dependencies!: string[] | null;

    @Column({ type: 'uuid', nullable: true })
    bundleId!: string | null;

    @ManyToOne('PenaiHomebrewBundle', { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'bundleId' })
    bundle!: import('./HomebrewBundlePenai.js').PenaiHomebrewBundle | null;

    @Column({ type: 'varchar', length: 16, default: 'original' })
    sourceKind!: PenaiHomebrewSourceKind;

    @Column({ type: 'varchar', length: 64, nullable: true })
    sourceResource!: string | null;

    @Column({ type: 'varchar', length: 128, nullable: true })
    sourceIndex!: string | null;

    @Column({ type: 'varchar', length: 16, default: 'pt-BR' })
    locale!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
