import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('sanitization_patterns')
@Index(['category', 'rawValue'], { unique: true })
export class SanitizationPattern {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column('varchar', { length: 80 })
    category!: string;

    @Column('varchar', { length: 255 })
    rawValue!: string;

    @Column('varchar', { length: 255 })
    normalizedValue!: string;

    @Column('simple-json', { nullable: true })
    metadata?: Record<string, any> | null;

    @Column('int', { default: 0 })
    occurrences!: number;

    @CreateDateColumn()
    firstSeenAt!: Date;

    @UpdateDateColumn()
    lastSeenAt!: Date;
}
