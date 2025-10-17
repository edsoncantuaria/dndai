// backend/src/entities/HomebrewBundle.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './User.js';
import { HomebrewContent } from './HomebrewContent.js';

@Entity('homebrew_bundles')
export class HomebrewBundle {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'authorId' })
    author: User;

    @Column({ type: 'int' })
    authorId: number;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'text' })
    description: string;

    @Column({ type: 'boolean', default: false })
    isPublic: boolean;
    
    @OneToMany(() => HomebrewContent, content => content.bundle)
    contents: HomebrewContent[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
