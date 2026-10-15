import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('rumors')
@Index(['sessionId'])
export class Rumor {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int', nullable: true })
    sessionId!: number | null;

    @Column({ type: 'varchar', length: 160 })
    title!: string;

    @Column({ type: 'text' })
    body!: string;

    @Column({ type: 'varchar', length: 64, nullable: true })
    regionSlug!: string | null;

    @Column({ type: 'varchar', length: 32, default: 'active' })
    status!: 'active' | 'faded' | 'confirmed';

    @Column({ type: 'varchar', length: 16, default: 'pt-BR' })
    locale!: string;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;
}
