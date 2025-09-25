import React, { useRef, useEffect, useState } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import type { LogEntry as LogEntryType } from '../types';
import { Swords, Wand, HeartPulse, Hand, Dice5, ChevronsRight, Sparkles, BrainCircuit, Loader2, Speaker } from 'lucide-react';
import { textToSpeech } from '@/ai/flows/textToSpeech';

const AudioPlayer: React.FC<{ text: string }> = ({ text }) => {
    const [audioData, setAudioData] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    const handlePlay = async () => {
        if (audioData) {
            audioRef.current?.play();
            setIsPlaying(true);
            return;
        }
        setIsLoading(true);
        try {
            const response = await textToSpeech(text);
            if (response?.media) {
                setAudioData(response.media);
            }
        } catch (error) {
            console.error("Error generating speech:", error);
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

    if (isDamageRoll) {
        outcomeText = `${total} de Dano`;
        themeColor = 'text-rose-300';
        bgColor = 'bg-rose-900/30 border-rose-700/50';
        resultColor = 'text-rose-400';
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
    const rollsText = rolls.length > 1 ? `[${rolls.join(', ')}]` : `(${total - (modifier || 0)})`;

    return (
         <div className={`${bgColor} border p-3 rounded-md text-sm space-y-1`}>
            <p className={`${themeColor} font-mono flex items-center gap-2`}><Dice5 className="h-4 w-4"/> {description}{advantageText}</p>
            <div className={`font-mono ${resultColor}`}>
                <span>Rolagem: {dice} {rollsText} {modifier >= 0 ? `+ ${modifier}`: `- ${Math.abs(modifier || 0)}`} = <span className="font-bold text-lg">{total}</span>. </span>
                {dc && <span className="text-stone-400 text-xs">(CD: {dc}) </span>}
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

    return <ChevronsRight className="text-amber-400 font-bold h-4 w-4" aria-hidden="true" />;
};


const LogEntry: React.FC<{ entry: LogEntryType }> = ({ entry }) => {
    let content;
    switch(entry.type) {
        case 'narration':
            content = (
                <div className="flex items-start">
                    <p className="text-stone-300 font-garamond text-lg italic leading-relaxed flex-grow">{entry.content}</p>
                    <AudioPlayer text={entry.content} />
                </div>
            );
            break;
        case 'action':
            content = (
                <div className="flex items-start gap-3 my-4 py-3 border-y-2 border-stone-700/50">
                    <div className="flex-shrink-0 pt-1">{getActionIcon(entry.content)}</div>
                    <p className="text-amber-400 font-semibold">{entry.content}</p>
                </div>
            );
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

    return <div className="animate-fadeInSlideUp">{content}</div>;
}

const NarrativeLog: React.FC = () => {
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
            {log.map((entry) => (
                <LogEntry key={entry.id} entry={entry} />
            ))}
            <div ref={logEndRef} />
        </div>
    );
};

export default NarrativeLog;
