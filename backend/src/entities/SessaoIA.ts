// backend/src/entities/SessaoIA.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn, DeleteDateColumn, Index } from "typeorm";
import { SessionLog } from "./SessionLog.js";
import { User } from "./User.js";
import { Character } from "./Character.js"; // Importa a nova entidade
import { CombatEncounter } from "./CombatEncounter.js";
import { TimelineEvent } from "./TimelineEvent.js";
import { StorySummary } from "./StorySummary.js";

@Entity('sessoes_ia')
export class SessaoIA {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 100 })
    nome: string;

    @Column({ type: 'varchar', length: 255, nullable: true }) // Permitir que seja nulo
    apiKey: string;
    
    @Column({ type: 'int' })
    userId: number;

    @ManyToOne(() => User, user => user.sessoes, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ type: 'int', nullable: true })
    characterId: number | null;
    
    @ManyToOne(() => Character, (character) => character.sessoes, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'characterId' })
    character: Character | null;

    @OneToMany(() => SessionLog, log => log.sessao, { cascade: true, eager: true })
    logs: SessionLog[];

    @OneToMany(() => CombatEncounter, combat => combat.sessao)
    combatEncounters: CombatEncounter[];

    @OneToMany(() => TimelineEvent, event => event.sessao)
    timelineEvents: TimelineEvent[];

    @OneToMany(() => StorySummary, summary => summary.sessao)
    storySummaries: StorySummary[];
    
    @Index()
    @Column({ type: 'simple-json', nullable: true })
    homebrewContentIds: string[]; // Armazena IDs de todo o conteúdo necessário para esta sessão

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deletedAt?: Date;
}
