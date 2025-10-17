// backend/src/entities/HomebrewContent.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User.js';

export type HomebrewContentType = 'race' | 'subrace' | 'class' | 'subclass' | 'spell' | 'item' | 'monster' | 'background' | 'feat';

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
        enum: ['race', 'subrace', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat'],
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

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
