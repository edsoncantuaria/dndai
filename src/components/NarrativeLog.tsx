import React, { useRef, useEffect, useState } from 'react';
// FIX: Corrected import path for local module.
import { useGameStateContext } from '../contexts/GameStateContext';
// FIX: Corrected import path for local module.
import type { LogEntry as LogEntryType } from '../types';
import { Icons } from './Icons';

const RollEntry: React.FC<{ entry: LogEntryType }> = ({ entry }) => {
    if (!entry.rollResult) return null;
    const { description, dice, total, modifier, success, advantage, disadvantage, rolls, rollType, dc } = entry.rollResult;
    const [showResult, setShowResult] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowResult(true);
        }, 1200);
        return () => clearTimeout(timer);
    }, []);

    const isDamageRoll = rollType === 'damage';

    let outcomeText = '';
    let themeColor = 'text-cyan-300';
    let bgColor = 'bg-stone-900/50 border-stone-700';
    let resultColor = 'text-cyan-400';
    let icon = '🎲';

    if (isDamageRoll) {
        outcomeText = `${total} de Dano`;
        themeColor = 'text-rose-300';
        bgColor = 'bg-rose-900/30 border-rose-700/50';
        resultColor = 'text-rose-400';
        icon = '💥';
    } else if (success !== undefined) {
        if (success) {
            outcomeText = rollType === 'attack' ? 'Acerto!' : 'Sucesso!';
            themeColor = 'text-green-300';
            bgColor = 'bg-green-900/30 border-green-700/50';
            resultColor = 'text-green-400';
        } else {
            outcomeText = rollType === 'attack' ? 'Erro!' : 'Falha.';
            themeColor = 'text-red-300';
            bgColor = 'bg-red-900/30 border-red-700/50';
            resultColor = 'text-red-400';
        }
    }

    const advantageText = advantage ? " (Vantagem)" : disadvantage ? " (Desvantagem)" : "";
    const rollsText = rolls.length > 1 ? `[${rolls.join(', ')}]` : `(${total - modifier})`;

    return (
         <div className={`${bgColor} border p-3 rounded-md text-sm space-y-1`}>
            <p className={`${themeColor} font-mono`}>{icon} {description}{advantageText}</p>
            {!showResult ? (
                <div className={`flex items-center gap-2 ${resultColor} font-mono h-5`}>
                    <Icons.Spinner className="h-4 w-4" />
                    <span>Rolando...</span>
                </div>
            ) : (
                <div className={`font-mono ${resultColor} h-5`}>
                    <span>Rolagem: {dice} {rollsText} {modifier >= 0 ? `+ ${modifier}`: `- ${Math.abs(modifier)}`} = <span className="font-bold text-lg">{total}</span>. </span>
                    {dc && <span className="text-stone-400 text-xs">(DC: {dc}) </span>}
                    <span className={`font-bold`}>{outcomeText}</span>
                </div>
            )}
        </div>
    );
}

const getActionIcon = (content: string) => {
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('conjuro') || lowerContent.includes('magia')) {
        return <Icons.Magic className="h-4 w-4 text-purple-400" title="Ação de Magia" />;
    }
    if (lowerContent.includes('ataco') || lowerContent.includes('ataque') || lowerContent.includes('lutar')) {
        return <Icons.Sword className="h-4 w-4 text-red-400" title="Ação de Combate" />;
    }
    if (lowerContent.includes('descanso')) {
        return <Icons.Moon className="h-4 w-4 text-blue-400" title="Ação de Descanso" />;
    }
    if (lowerContent.includes('pego') || lowerContent.includes('saio') || lowerContent.includes('converso') || lowerContent.includes('examinar') || lowerContent.includes('abro')) {
        return <Icons.Hand className="h-4 w-4 text-green-400" title="Ação de Interação" />;
    }
    if (lowerContent.includes('tento usar') || lowerContent.includes('uso') || lowerContent.includes('perícia')) {
        return <Icons.Target className="h-4 w-4 text-cyan-400" title="Ação de Perícia" />;
    }

    // Default icon
    return <span className="text-amber-400 font-bold" aria-hidden="true">&gt;</span>;
};


const LogEntry: React.FC<{ entry: LogEntryType }> = ({ entry }) => {
    let content;
    switch(entry.type) {
        case 'narration':
            content = <p className="text-stone-300 font-garamond text-lg italic leading-relaxed">{entry.content}</p>;
            break;
        case 'action':
            content = (
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 pt-1">{getActionIcon(entry.content)}</div>
                    <p className="text-amber-400 font-semibold">{entry.content}</p>
                </div>
            );
            break;
        case 'roll':
            content = <RollEntry entry={entry} />;
            break;
        case 'system':
             content = <p className="text-yellow-500/80 text-sm font-semibold italic text-center py-2">-- {entry.content} --</p>;
             break;
        case 'combat':
             content = <p className="text-red-400 text-sm font-semibold">{entry.content}</p>;
             break;
        case 'insight':
             content = <p className="text-purple-300/90 text-sm font-semibold italic text-center py-2 flex items-center justify-center gap-2"><Icons.Thought /> {entry.content} </p>;
             break;
        default:
            content = null;
    }

    return <div className="animate-fadeInSlideUp">{content}</div>;
}

const NarrativeLog: React.FC = () => {
    const { log } = useGameStateContext();
    const logEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [log]);

    return (
        <div className="space-y-4">
            {log.map((entry) => (
                <LogEntry key={entry.id} entry={entry} />
            ))}
            <div ref={logEndRef} />
        </div>
    );
};

export default NarrativeLog;