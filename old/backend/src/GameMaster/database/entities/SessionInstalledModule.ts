import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('session_installed_modules')
@Index(['sessionId', 'moduleId'], { unique: true })
export class SessionInstalledModule {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'int' })
    sessionId!: number;

    @Column({ type: 'varchar', length: 64 })
    moduleId!: string;

    @Column({ type: 'varchar', length: 16 })
    version!: string;

    @Column({ type: 'varchar', length: 32 })
    kind!: 'translation' | 'race' | 'spellbook' | 'rule_patch';

    @Column({ type: 'jsonb', default: {} })
    payload!: Record<string, unknown>;
}
