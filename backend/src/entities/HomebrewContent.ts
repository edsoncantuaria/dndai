// backend/src/entities/HomebrewContent.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, OneToOne } from 'typeorm';
import { User } from './User.js';
import { HomebrewBundle } from './HomebrewBundle.js'; // Importar Bundle

export type HomebrewContentType = 'race' | 'subrace' | 'class' | 'subclass' | 'spell' | 'item' | 'monster' | 'background' | 'feat' | 'skill' | 'translation';

export type HomebrewSourceKind = 'original' | 'translation' | 'fork';

@Entity('homebrew_content')
export class HomebrewContent {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'authorId' })
    author: User;

    @Column({ type: 'int' })
    authorId: number;

    @Index()
    @Column({
        type: 'enum',
        enum: ['race', 'subrace', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat', 'translation'],
    })
    type: HomebrewContentType;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'json' })
    content: any; // O objeto JSON completo que segue o padrão OpenAPI

    @Index()
    @Column({ type: 'boolean', default: false })
    isPublic: boolean;
    
    @Column({
        type: 'enum',
        enum: ['user', 'ai'],
        default: 'user'
    })
    createdBy: 'user' | 'ai';
    
    @Column({ type: 'simple-json', nullable: true })
    dependencies: string[]; // Armazena os IDs de outros conteúdos homebrew
    
    @ManyToOne(() => HomebrewBundle, bundle => bundle.contents, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'bundleId' })
    bundle: HomebrewBundle | null;
    
    @Column({ type: 'varchar', length: 36, nullable: true })
    bundleId: string | null;

    /** original = conteúdo novo; translation = overlay PT sobre SRD; fork = variante derivada. */
    @Column({
        type: 'enum',
        enum: ['original', 'translation', 'fork'],
        default: 'original',
    })
    sourceKind: HomebrewSourceKind;

    /** Coleção SRD (spells, races, equipment…). */
    @Column({ type: 'varchar', length: 64, nullable: true })
    sourceResource: string | null;

    /** Índice oficial no SRD (ex: fireball). */
    @Column({ type: 'varchar', length: 128, nullable: true })
    sourceIndex: string | null;

    @Column({ type: 'varchar', length: 16, default: 'pt-BR' })
    locale: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
