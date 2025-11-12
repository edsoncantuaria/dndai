import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('enemy_templates')
@Index(['slug'], { unique: true })
export class EnemyTemplate {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 120 })
    name: string;

    @Column({ type: 'varchar', length: 140 })
    slug: string;

    @Column({ type: 'json', nullable: true })
    stats: Record<string, number | undefined> | null;

    @Column({ type: 'int', unsigned: true, nullable: true })
    hitPoints: number | null;

    @Column({ type: 'int', unsigned: true, nullable: true })
    armorClass: number | null;

    @Column({ type: 'int', unsigned: true, nullable: true })
    actionPoints: number | null;

    @Column({ type: 'int', unsigned: true, nullable: true })
    bonusActionPoints: number | null;

    @Column({ type: 'json', nullable: true })
    damageProfile: Record<string, any> | null;

    @Column({ type: 'simple-array', nullable: true })
    tags: string[] | null;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

