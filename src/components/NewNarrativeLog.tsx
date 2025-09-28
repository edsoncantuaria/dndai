'use client';
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import type { LogEntry as LogEntryType, Combatant } from '../types';
import { Swords, Wand, HeartPulse, Hand, Dice5, ChevronsRight, Sparkles, BrainCircuit, Loader2, Speaker } from 'lucide-react';
import { textToSpeech } from '@/ai/flows/textToSpeech';
import { useSettingsContext } from '../contexts/SettingsContext';
import Image from 'next/image';

const AudioPlayer: React.FC<{ text: string }> = ({ text }) => {
    const [audioData, setAudioData] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);
    const { ttsModel, ttsVoice, volume, isMuted } = useSettingsContext();
    const { getApiKey } = useGameStateContext();

    const handlePlay = async () => {
        if (audioData && audioRef.current) {
            audioRef.current.play();
            setIsPlaying(true);
            return;
        }
        setIsLoading(true);
        try {
            const apiKeyToUse = getApiKey();
            if (!apiKeyToUse) {
                console.warn("Chave de API não encontrada para TTS, pulando.");
                return; 
            }
            const response = await textToSpeech(text, ttsModel, ttsVoice, apiKeyToUse);
            if (response?.media) {
                setAudioData(response.media);
            }
        } catch (error) {
            console.error("Error generating speech silently:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (audioData && audioRef.current) {
            audioRef.current.src = audioData;
            audioRef.current.play();
            setIsPlaying(true);
        }
    }, [audioData]);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.muted = isMuted;
            audioRef.current.volume = volume;
        }
    }, [isMuted, volume]);

    const handleAudioEnded = () => {
        setIsPlaying(false);
    };

    return (
        <div className="inline-block ml-2">
            <button onClick={handlePlay} disabled={isLoading || isPlaying} className="text-stone-400 hover:text-amber-300 disabled:opacity-50">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Speaker className="h-4 w-4" />}
            </button>
            {audioData && <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />}
        </div>
    );
};

const RollEntry: React.FC<{ entry: LogEntryType }> = ({ entry }) => {
    if (!entry.rollResult) return null;
    const { description, dice, total, modifier, success, advantage, disadvantage, rolls, rollType, dc } = entry.rollResult;
    
    const isDamageRoll = rollType === 'damage';

    let outcomeText = '';
    let themeColor = 'text-cyan-300';
    let bgColor = 'bg-stone-900/50 border-stone-700';
    let resultColor = 'text-cyan-400';

    if (!isDamageRoll && success !== undefined) {
        if (success) {
            outcomeText = 'Sucesso!';
            themeColor = 'text-green-300';
            bgColor = 'bg-green-900/30 border-green-700/50';
            resultColor = 'text-green-400';
        } else {
            outcomeText = 'Falha.';
            themeColor = 'text-red-300';
            bgColor = 'bg-red-900/30 border-red-700/50';
            resultColor = 'text-red-400';
        }
    } else if (isDamageRoll) {
        outcomeText = `${total} de Dano`;
        themeColor = 'text-rose-300';
        bgColor = 'bg-rose-900/30 border-rose-700/50';
        resultColor = 'text-rose-400';
    }

    const advantageText = advantage ? " (Vantagem)" : disadvantage ? " (Desvantagem)" : "";
    const rollsText = rolls?.join(', ') || total - (modifier || 0);

    return (
         <div className={`${bgColor} border p-3 rounded-md text-sm space-y-1`}>
            <p className={`${themeColor} font-mono flex items-center gap-2`}><Dice5 className="h-4 w-4"/> {description}{advantageText}</p>
            <div className={`font-mono ${resultColor}`}>
                <span>Rolagem: {dice} ({rollsText}) {modifier ? (modifier >= 0 ? `+ ${modifier}` : `- ${Math.abs(modifier)}`) : ''} = <span className="font-bold text-lg">{total}</span>. </span>
                {dc !== undefined && <span className="text-stone-400 text-xs">(CD: {dc}) </span>}
                <span className={`font-bold`}>{outcomeText}</span>
            </div>
        </div>
    );
}

const getActionIcon = (content: string) => {
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


const LogEntry = React.memo(function LogEntry({ entry, index }: { entry: LogEntryType, index: number }) {
    let content;
    switch(entry.type) {
        case 'narration':
            content = (
                <div className="flex items-start">
                    <p className="text-stone-300 font-serif text-lg italic leading-relaxed flex-grow">{entry.content}</p>
                    <AudioPlayer text={entry.content} />
                </div>
            );
            break;
        case 'action':
             // Hide internal processing actions from the log
            if (typeof entry.content === 'string' && entry.content.startsWith("Processar")) {
                content = null;
            } else {
                content = (
                    <div className="flex items-start gap-3 my-4 py-3 border-y-2 border-stone-700/50">
                        <div className="flex-shrink-0 pt-1">{getActionIcon(entry.content as string)}</div>
                        <p className="text-amber-400 font-semibold">{entry.content}</p>
                    </div>
                );
            }
            break;
        case 'roll':
            content = <RollEntry entry={entry} />;
            break;
        case 'system':
             content = <p className="text-yellow-500/80 text-sm font-semibold italic text-center py-2 flex items-center justify-center gap-2"><Sparkles className="h-4 w-4"/> {entry.content} </p>;
             break;
        case 'combat':
             content = <p className="text-red-400 text-sm font-semibold">{entry.content}</p>;
             break;
        case 'insight':
             content = <p className="text-purple-300/90 text-sm font-semibold italic text-center py-2 flex items-center justify-center gap-2"><BrainCircuit className="h-4 w-4"/> {entry.content} </p>;
             break;
        default:
            content = null;
    }
    if(content === null) return null;

    return <div className="animate-fadeIn" style={{ animationDelay: `${Math.min(index * 100, 500)}ms`, animationDuration: '400ms' }}>{content}</div>;
});

const NpcRollDisplay: React.FC = () => {
    const { combatState, character } = useGameStateContext();

    const initiativeString = useMemo(() => {
        if (!combatState.isActive || !combatState.initiativeOrder || combatState.initiativeOrder.length === 0) return null;

        const order = combatState.initiativeOrder.map(entry => {
            const id = typeof entry === 'object' ? entry.id : entry;
            const combatant = combatState.combatants.find(c => c.id === id || c.name === id); // Handle player name as ID
            const name = combatant?.name || (id === character?.name ? character.name : id);
            const initiative = typeof entry === 'object' ? entry.initiative : combatant?.initiative;
            return `${name} (${initiative ?? '?'})`;
        }).join(', ');

        return `A ordem de iniciativa é: ${order}.`;
    }, [combatState, character]);

    const lastNpcRolls = useMemo(() => {
        if (!combatState.isActive || !combatState.combatants) return [];
        const lastTurnIndex = (combatState.turn - 1 + combatState.combatants.length) % combatState.combatants.length;
        if (!combatState.initiativeOrder || combatState.initiativeOrder.length === 0) return [];
        
        const lastCombatantId = typeof combatState.initiativeOrder[lastTurnIndex] === 'object' 
            ? (combatState.initiativeOrder[lastTurnIndex] as {id: string}).id
            : combatState.initiativeOrder[lastTurnIndex] as string;

        if (!lastCombatantId) return [];
        const lastCombatant = combatState.combatants.find(c => c.id === lastCombatantId);
        
        if (!lastCombatant || lastCombatant.isPlayer) return [];

        return lastCombatant.rollHistory?.slice().reverse()
            .filter(r => r.type === 'attack' || r.type === 'damage')
            .map(r => {
                const targetAc = (r as any).targetAc ? ` vs CA ${(r as any).targetAc}` : '';
                const successText = r.success === true ? 'Acertou!' : r.success === false ? 'Errou!' : '';
                const rollsDisplay = r.rolls && r.rolls.length > 0 ? `(${r.rolls.join(', ')}${r.modifier ? `+${r.modifier}`: ''})`: '';
                return `${lastCombatant.name} ${r.description || r.type}: ${r.total} ${rollsDisplay}${targetAc}. ${successText}`;
            }) || [];

    }, [combatState]);
    
    if (!combatState.isActive) return null;
    
    return (
        <>
            {initiativeString && (
                <div className="bg-stone-900/60 p-3 my-2 rounded-md border border-stone-700 text-sm font-semibold">
                    <p className="text-stone-300 font-mono">{initiativeString}</p>
                </div>
            )}
             {lastNpcRolls.length > 0 && (
                 <div className="bg-red-900/30 p-3 my-2 rounded-md border border-red-700/50 text-sm space-y-1">
                    {lastNpcRolls.map((rollString, index) => (
                        <p key={index} className="text-red-200 font-mono">{rollString}</p>
                    ))}
                </div>
            )}
        </>
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
            {log.map((entry, index) => (
                <LogEntry key={entry.id} entry={entry} index={log.length - 1 - index} />
            ))}
            <div ref={logEndRef} />
        </div>
    );
};

export default NewNarrativeLog;
