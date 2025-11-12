import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('scenario_examples')
@Index(['scenarioLabel', 'focus', 'createdAt'])
export class ScenarioExample {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 80 })
    scenarioLabel: string;

    @Column({ type: 'varchar', length: 16 })
    focus: string;

    @Column({ type: 'text' })
    snippet: string;

    @Column({ type: 'json', nullable: true })
    metadata: Record<string, unknown> | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

