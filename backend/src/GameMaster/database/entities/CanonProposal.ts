import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('canon_proposals')
export class CanonProposal {
    @PrimaryColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 32 })
    kind!: 'region' | 'poi';

    @Column({ type: 'varchar', length: 160 })
    displayName!: string;

    @Column({ type: 'varchar', length: 120, nullable: true })
    regionSlug!: string | null;

    @Column({ type: 'varchar', length: 32, default: 'pending' })
    status!: 'pending' | 'approved' | 'rejected';

    @Column({ type: 'varchar', length: 16, default: 'pt-BR' })
    locale!: string;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt!: Date;
}
