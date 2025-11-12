// backend/src/entities/SrdResource.ts
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('srd_resources')
@Index(['resource', 'index'], { unique: true })
export class SrdResource {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 64 })
    resource!: string;

    @Column({ type: 'varchar', length: 128 })
    index!: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    name?: string;

    @Column({ type: 'json' })
    payload!: any;

    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    syncedAt!: Date;
}
