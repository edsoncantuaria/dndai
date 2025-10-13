// backend/src/entities/User.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, OneToMany, JoinColumn } from 'typeorm';
import { LicenseKey } from './LicenseKey.js';
import { SessaoIA } from './SessaoIA.js';

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

    @OneToOne(() => LicenseKey)
    @JoinColumn({ name: 'licenseKeyId' })
    licenseKey: LicenseKey;

    @OneToMany(() => SessaoIA, (sessao) => sessao.user)
    sessoes: SessaoIA[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
