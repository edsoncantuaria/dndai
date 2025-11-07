// src/components/NewNarrativeLog.tsx
'use client';
import React, { useRef, useEffect, useState } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import type { LogEntry as LogEntryType } from '../types';
import { Swords, Wand, HeartPulse, Hand, Dice5, ChevronsRight, Sparkles, BrainCircuit } from 'lucide-react';

const NarrationEntry: React.FC<{ entry: LogEntryType }> = ({ entry }) => {
    let textContent = entry.content;
    
    // Defensive check: If content is a stringified JSON, parse it to get the actual text.
    if (typeof textContent === 'string') {
        try {
            const parsed = JSON.parse(textContent);
            if (typeof parsed === 'object' && parsed !== null && ('content' in parsed || 'text' in parsed)) {
                textContent = parsed.content || parsed.text;
            }
        } catch (e) {
            // Not a JSON string, which is the expected case. Do nothing.
        }
    }
    
    if (typeof textContent !== 'string' || !textContent.trim()) {
        return null;
    }
    
    return (
        <div className="flex items-start">
            <p className="text-stone-300 leading-relaxed flex-grow font-sans">
                {textContent}
            </p>
        </div>
    );
};


const RollEntry: React.FC<{ entry: LogEntryType }> = ({ entry }) => {
    if (!entry.rollResult) return null;
    const { description, dice, total, modifier, success, advantage, disadvantage, rolls, rollType, dc } = entry.rollResult;
    
    const isDamageRoll = rollType === 'damage';

    const palette = (() => {
        if (isDamageRoll) {
            return {
                badge: 'bg-rose-500/20 text-rose-200 border border-rose-300/30',
                border: 'border-rose-400/30',
                gradient: 'from-rose-900/50 via-rose-900/20 to-transparent',
                accent: 'text-rose-300'
            };
        }
        if (success === true) {
            return {
                badge: 'bg-emerald-500/15 text-emerald-200 border border-emerald-300/30',
                border: 'border-emerald-400/30',
                gradient: 'from-emerald-900/45 via-emerald-900/15 to-transparent',
                accent: 'text-emerald-300'
            };
        }
        if (success === false) {
            return {
                badge: 'bg-red-500/15 text-red-200 border border-red-300/30',
                border: 'border-red-400/30',
                gradient: 'from-red-900/45 via-red-900/15 to-transparent',
                accent: 'text-red-300'
            };
        }
        return {
            badge: 'bg-cyan-500/15 text-cyan-200 border border-cyan-300/30',
            border: 'border-cyan-400/30',
            gradient: 'from-slate-900/50 via-slate-900/15 to-transparent',
            accent: 'text-cyan-300'
        };
    })();

    const outcomeText = isDamageRoll
        ? `${total} de Dano`
        : success === true
            ? 'Sucesso'
            : success === false
                ? 'Falha'
                : 'Resultado';

    const advantageText = advantage ? "Vantagem" : disadvantage ? "Desvantagem" : null;
    const rollsText = rolls?.join(', ') || total - (modifier || 0);

    return (
         <div className={`relative overflow-hidden rounded-2xl border ${palette.border} bg-black/40 p-4 text-sm shadow-lg`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${palette.gradient} opacity-80 pointer-events-none`} />
            <div className="relative space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-stone-400">
                    <span className={`px-2 py-0.5 rounded-full ${palette.badge} font-semibold flex items-center gap-1`}>
                        <Dice5 className="h-3.5 w-3.5" /> {outcomeText}
                    </span>
                    {advantageText && (
                        <span className="px-2 py-0.5 rounded-full border border-white/10 text-stone-200">
                            {advantageText}
                        </span>
                    )}
                    {typeof dc === 'number' && (
                        <span className="px-2 py-0.5 rounded-full border border-white/10 text-stone-200">
                            CD {dc}
                        </span>
                    )}
                </div>
                <p className={`font-semibold text-base ${palette.accent}`}>{description}</p>
                <div className="rounded-2xl border border-white/10 bg-black/40 p-3 font-mono text-stone-200">
                    <p>
                        {dice} ({rollsText}) {modifier ? (modifier >= 0 ? `+ ${modifier}` : `- ${Math.abs(modifier || 0)}`) : ''} ={' '}
                        <span className="text-2xl font-bold">{total}</span>
                    </p>
                </div>
            </div>
        </div>
    );
}

const getActionIcon = (content: string) => {
    if (typeof content !== 'string') {
        return <ChevronsRight className="text-amber-400 font-bold h-4 w-4" aria-hidden="true" />;
    }
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('conjuro') || lowerContent.includes('magia')) {
        return <Wand className="h-4 w-4 text-purple-400" title="Ação de Magia" />;
    }
    if (lowerContent.includes('ataco') || lowerContent.includes('ataque') || lowerContent.includes('lutar')) {
        return <Swords className="h-4 w-4 text-red-400" title="Ação de Combate" />;
    }
    if (lowerContent.includes('descanso')) {
        return <HeartPulse className="h-4 w-4 text-blue-400" title="Ação de Descanso" />;
    }
    if (lowerContent.includes('pego') || lowerContent.includes('saio') || lowerContent.includes('converso') || lowerContent.includes('examinar') || lowerContent.includes('abro')) {
        return <Hand className="h-4 w-4 text-green-400" title="Ação de Interação" />;
    }
    if (lowerContent.includes('tento usar') || lowerContent.includes('uso') || lowerContent.includes('perícia')) {
        return <Dice5 className="h-4 w-4 text-cyan-400" title="Ação de Perícia" />;
    }
    if (lowerContent.includes('rolagem')) {
        return <Dice5 className="h-4 w-4 text-cyan-400" title="Rolagem de Dados" />;
    }

    return <ChevronsRight className="text-amber-400 font-bold h-4 w-4" aria-hidden="true" />;
};


const LogEntry = React.memo(function LogEntry({ entry }: { entry: LogEntryType }) {
    let contentComponent;

    // Ação interna do sistema, não deve ser renderizada.
    if (entry.type === 'action' && typeof entry.content === 'string' && (entry.content.startsWith("Recarregar estado atual") || entry.content.startsWith("A aventura começa.") || entry.content.includes("Gere uma resposta de Mestre de Jogo que demonstre todas as suas capacidades"))) {
        return null;
    }

    switch(entry.type) {
        case 'narration':
            contentComponent = <NarrationEntry entry={entry} />;
            break;
        case 'action':
             if (typeof entry.content === 'string' && entry.content.trim()) {
                 contentComponent = (
                    <div className="flex items-start gap-3 my-4 py-3 border-y-2 border-stone-700/50">
                        <div className="flex-shrink-0 pt-1">{getActionIcon(entry.content as string)}</div>
                        <p className="text-amber-400 font-semibold">{entry.content}</p>
                    </div>
                );
             } else {
                 contentComponent = null;
             }
            break;
        case 'roll':
            contentComponent = <RollEntry entry={entry} />;
            break;
        case 'system':
             contentComponent = <p className="text-yellow-500/80 text-sm font-semibold italic text-center py-2 flex items-center justify-center gap-2"><Sparkles className="h-4 w-4"/> {entry.content} </p>;
             break;
        case 'combat':
             contentComponent = <p className="text-red-400 text-sm font-semibold">{entry.content}</p>;
             break;
        case 'insight':
             contentComponent = <p className="text-purple-300/90 text-sm font-semibold italic text-center py-2 flex items-center justify-center gap-2"><BrainCircuit className="h-4 w-4"/> {entry.content} </p>;
             break;
        default:
             contentComponent = null;
    }
    
    if(contentComponent === null) return null;

    return <div className="animate-fadeIn" style={{animationDuration: '500ms'}}>{contentComponent}</div>;
});


const NpcRollDisplay: React.FC = () => {
    const { combatState, character } = useGameStateContext();

    const initiativeString = React.useMemo(() => {
        if (!combatState.isActive || !combatState.initiativeOrder || combatState.initiativeOrder.length === 0) return null;

        const order = combatState.initiativeOrder.map(entry => {
            const id = typeof entry === 'object' ? (entry as any).id : entry as string;
            const combatant = combatState.combatants.find(c => c.id === id || c.name === id);
            const name = combatant?.name || (id === character?.name ? character.name : id);
            const initiative = typeof entry === 'object' ? (entry as any).initiative : combatant?.initiative;
            return `${name} (${initiative ?? '?'})`;
        }).join(', ');

        return `A ordem de iniciativa é: ${order}.`;
    }, [combatState, character]);
    
    if (!combatState.isActive || !initiativeString) return null;
    
    return (
        <div className="bg-stone-900/60 p-3 my-2 rounded-md border border-stone-700 text-sm font-semibold">
            <p className="text-stone-300 font-mono">{initiativeString}</p>
        </div>
    );
};

const NewNarrativeLog: React.FC = () => {
    const { log } = useGameStateContext();
    const logEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [log]);

    if (!log || log.length === 0) {
        return (
            <div className="text-center text-stone-500 italic p-8">
                A aventura ainda não começou.
            </div>
        );
    }
    
    return (
        <div className="space-y-4">
            <NpcRollDisplay />
            {log.map((entry) => {
                if(!entry || !entry.id) return null;
                return <LogEntry key={entry.id} entry={entry} />
            })}
            <div ref={logEndRef} />
        </div>
    );
};

export default NewNarrativeLog;
