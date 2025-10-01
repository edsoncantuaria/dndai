import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn, JoinColumn, OneToOne } from 'typeorm';
import { Character } from './Character';
import { LicenseKey } from './LicenseKey';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    username!: string;

    @Column({ unique: true })
    email!: string;

    @Column()
    password!: string;

    @Column({ name: 'google_api_key_encrypted', type: 'text', nullable: true })
    googleApiKeyEncrypted!: string | null;

    @OneToOne(() => LicenseKey)
    @JoinColumn({ name: 'license_key_id' })
    licenseKey!: LicenseKey | null;

    @OneToMany(() => Character, character => character.user)
    characters!: Character[];

    @Column({ default: true, name: 'is_active' })
    isActive!: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;

    @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
    deletedAt!: Date | null;
}
