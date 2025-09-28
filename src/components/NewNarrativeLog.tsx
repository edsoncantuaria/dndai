'use client';
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import type { LogEntry as LogEntryType } from '../types';
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
    const rollsText = rolls.join(', ');

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
    const { combatState } = useGameStateContext();

    const initiativeRolls = useMemo(() => {
        if (!combatState.isActive || !combatState.combatants) return [];
        return combatState.combatants.map(c => {
            const initRoll = c.rollHistory?.find(r => r.type === 'initiative');
            if (initRoll) {
                return `${c.name}: ${initRoll.total} (${initRoll.rolls.join(', ')} + ${initRoll.modifier || 0})`;
            }
            return null;
        }).filter(Boolean);
    }, [combatState]);

    const lastNpcRoll = useMemo(() => {
        if (!combatState.isActive || !combatState.combatants) return null;

        const lastCombatant = combatState.combatants[(combatState.turn - 1 + combatState.combatants.length) % combatState.combatants.length];
        if (!lastCombatant || lastCombatant.id.includes('_player')) return null;

        const lastAttack = lastCombatant.rollHistory?.slice().reverse().find(r => r.type === 'attack');
        if (!lastAttack) return null;
        
        return `${lastCombatant.name} ataca: ${lastAttack.total} (${lastAttack.rolls.join(', ')} + ${lastAttack.modifier || 0}) vs CA ${lastAttack.targetAc}. ${lastAttack.success ? 'Acertou!' : 'Errou!'}`;

    }, [combatState]);

    if (!combatState.isActive) return null;

    return (
        <>
            {initiativeRolls.length > 0 && (
                <div className="bg-stone-900/60 p-3 my-2 rounded-md border border-stone-700 text-sm">
                    <h5 className="font-bold text-amber-300 mb-1">Iniciativa:</h5>
                    <p className="text-stone-300 font-mono">{combatState.initiativeOrder?.map(c => `${c.id} (${c.initiative})`).join(', ')}</p>
                </div>
            )}
             {lastNpcRoll && (
                 <div className="bg-red-900/30 p-3 my-2 rounded-md border border-red-700/50 text-sm">
                    <p className="text-red-200 font-mono">{lastNpcRoll}</p>
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
            {log.map((entry, index) => (
                <LogEntry key={entry.id} entry={entry} index={log.length - 1 - index} />
            ))}
            <NpcRollDisplay />
            <div ref={logEndRef} />
        </div>
    );
};

export default NewNarrativeLog;
