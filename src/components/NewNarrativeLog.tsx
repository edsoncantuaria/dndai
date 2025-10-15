// src/components/NewNarrativeLog.tsx
'use client';
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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

    const handlePlay = useCallback(async () => {
        if (isPlaying && audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
            return;
        }

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
            console.error("Error generating speech:", error);
        } finally {
            setIsLoading(false);
        }
    }, [audioData, getApiKey, isPlaying, text, ttsModel, ttsVoice]);

    useEffect(() => {
        if (audioData && audioRef.current) {
            audioRef.current.src = audioData;
            audioRef.current.play()
                .then(() => setIsPlaying(true))
                .catch(e => console.error("Audio play failed:", e));
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
            <button onClick={handlePlay} disabled={isLoading} className="text-stone-400 hover:text-amber-300 disabled:opacity-50">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Speaker className={`h-4 w-4 ${isPlaying ? 'text-amber-400' : ''}`} />}
            </button>
            {audioData && <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />}
        </div>
    );
};

const NarrationEntry: React.FC<{ entry: LogEntryType; isMostRecent: boolean }> = ({ entry, isMostRecent }) => {
    const [displayedText, setDisplayedText] = useState(isMostRecent ? '' : (entry.content || ''));
    const isAnimating = useRef(isMostRecent);

    useEffect(() => {
        if (!isMostRecent || !isAnimating.current) {
            setDisplayedText(entry.content || '');
            return;
        }

        const words = (entry.content || '').split(' ');
        let currentIndex = 0;
        let animationFrameId: number;

        const animate = () => {
            if (currentIndex < words.length) {
                setDisplayedText(prev => prev + (currentIndex > 0 ? ' ' : '') + words[currentIndex]);
                currentIndex++;
                animationFrameId = requestAnimationFrame(animate);
            } else {
                isAnimating.current = false;
            }
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(animationFrameId);
    }, [entry.content, isMostRecent]);

    const isAnimationComplete = !isAnimating.current;

    return (
        <div className="flex items-start">
            <p className="text-stone-300 leading-relaxed flex-grow font-sans">
                {displayedText}
                {!isAnimationComplete && <span className="animate-pulse">_</span>}
            </p>
            {isAnimationComplete && <AudioPlayer text={entry.content} />}
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
            resultColor = 'text-red-500';
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
                <span>Rolagem: {dice} ({rollsText}) {modifier ? (modifier >= 0 ? `+ ${modifier}` : `- ${Math.abs(modifier || 0)}`) : ''} = <span className="font-bold text-lg">{total}</span>. </span>
                {dc !== undefined && <span className="text-stone-400 text-xs">(CD: {dc}) </span>}
                <span className={`font-bold`}>{outcomeText}</span>
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


const LogEntry = React.memo(function LogEntry({ entry, isMostRecent }: { entry: LogEntryType, isMostRecent: boolean }) {
    let content;
    switch(entry.type) {
        case 'narration':
            content = <NarrationEntry entry={entry} isMostRecent={isMostRecent} />;
            break;
        case 'action':
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
        case 'image':
            const imageContent = entry.content as any;
            content = (
                <div className="my-4 rounded-lg overflow-hidden border-2 border-stone-600 shadow-lg">
                    {imageContent.status === 'done' && imageContent.url ? (
                        <Image src={imageContent.url} alt="Cena gerada pela IA" width={1024} height={576} className="w-full h-auto" />
                    ) : (
                        <div className="w-full aspect-video bg-stone-800 flex items-center justify-center text-stone-500">
                            {imageContent.status === 'generating' && 
                                <>
                                    <Loader2 className="h-8 w-8 mr-2 animate-spin"/> 
                                    <span>Gerando imagem...</span>
                                </>
                            }
                            {imageContent.status === 'failed' && 'Falha ao gerar imagem.'}
                        </div>
                    )}
                </div>
            );
            break;
        default:
            content = null;
    }
    if(content === null) return null;

    return <div>{content}</div>;
});

const NpcRollDisplay: React.FC = () => {
    const { combatState, character } = useGameStateContext();

    const initiativeString = useMemo(() => {
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
            {log.map((entry, index) => {
                if(!entry) return null;
                return <LogEntry key={entry.id} entry={entry} isMostRecent={index === log.length - 1} />
            })}
            <div ref={logEndRef} />
        </div>
    );
};

export default NewNarrativeLog;
