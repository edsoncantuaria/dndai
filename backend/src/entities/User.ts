import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Character } from './Character';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    username!: string;

    @Column()
    password!: string;

    @Column({ name: 'license_key' })
    licenseKey!: string;

    @Column({ name: 'google_api_key_encrypted', type: 'text', nullable: true })
    googleApiKeyEncrypted!: string | null;

    @OneToMany(() => Character, character => character.user)
    characters!: Character[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
