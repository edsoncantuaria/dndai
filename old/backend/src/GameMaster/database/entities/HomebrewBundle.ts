import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
} from 'typeorm';
import type { PenaiHomebrewContent } from './HomebrewContent.js';

@Entity('penai_homebrew_bundles')
export class PenaiHomebrewBundle {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'int' })
    authorId!: number;

    @Column({ type: 'varchar', length: 255 })
    name!: string;

    @Column({ type: 'text' })
    description!: string;

    @Column({ type: 'boolean', default: false })
    isPublic!: boolean;

    @OneToMany('PenaiHomebrewContent', 'bundle')
    contents!: PenaiHomebrewContent[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
