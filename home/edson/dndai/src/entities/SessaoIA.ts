// backend/src/entities/SessaoIA.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from "typeorm";
import { SessionLog } from "./SessionLog.js";
import { User } from "./User.js";

/**
 * Entidade que representa uma sessão de jogo de IA.
 * Cada sessão possui sua própria chave de API e um histórico de logs.
 */
@Entity('sessoes_ia')
export class SessaoIA {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 100 })
    nome: string;

    /**
     * Armazena a chave de API do Google Gemini para esta sessão.
     * Em um ambiente de produção real, isso DEVE ser criptografado.
     */
    @Column({ type: 'varchar', length: 255 })
    apiKey: string;
    
    @Column()
    userId: number;

    @ManyToOne(() => User, user => user.sessoes, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @OneToMany(() => SessionLog, log => log.sessao, { cascade: true })
    logs: SessionLog[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
