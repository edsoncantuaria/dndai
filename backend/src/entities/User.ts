// backend/src/entities/User.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, OneToMany, JoinColumn, DeleteDateColumn, Index } from 'typeorm';
import { LicenseKey } from './LicenseKey.js';
import { SessaoIA } from './SessaoIA.js';
import { Character } from './Character.js';
import { HomebrewContent } from './HomebrewContent.js';
import { HomebrewBundle } from './HomebrewBundle.js';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 50, unique: true })
    username: string;

    @Column({ type: 'varchar', unique: true, length: 100 })
    email: string;

    @Column({ type: 'varchar', length: 255 })
    password: string;

    @Column({ type: 'int', nullable: true })
    licenseKeyId: number;

    @Column({ type: 'simple-json', nullable: true })
    settings: Record<string, any>;
    
    @Column({ type: 'boolean', default: false })
    acknowledgedHomebrewDisclaimer: boolean;

    @Index()
    @Column({ type: 'simple-json', nullable: true })
    installedHomebrewIds: string[];

    @OneToOne(() => LicenseKey)
    @JoinColumn({ name: 'licenseKeyId' })
    licenseKey: LicenseKey;

    @OneToMany(() => SessaoIA, (sessao) => sessao.user)
    sessoes: SessaoIA[];

    @OneToMany(() => Character, (character) => character.user)
    characters: Character[];
    
    @OneToMany(() => HomebrewContent, (content) => content.author)
    homebrewContents: HomebrewContent[];

    @OneToMany(() => HomebrewBundle, (bundle) => bundle.author)
    homebrewBundles: HomebrewBundle[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deletedAt?: Date;
}
