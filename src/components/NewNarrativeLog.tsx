// src/components/NewNarrativeLog.tsx
'use client';
import React, { useRef, useEffect, useState } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import type { LogEntry as LogEntryType } from '../types';
import { Swords, Wand, HeartPulse, Hand, Dice5, ChevronsRight, Sparkles, BrainCircuit, Loader2, Image as ImageIcon } from 'lucide-react';
import { useSettingsContext } from '@/contexts/SettingsContext';
import * as AiService from '../services/aiService';
import Image from 'next/image';

const ImageEntry: React.FC<{ entry: LogEntryType }> = ({ entry }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { imageModel } = useSettingsContext();
    const { getApiKey, sessionId } = useGameStateContext();

    useEffect(() => {
        const imageContent = entry.content as any;
        if (imageContent.status === 'generating' && imageContent.prompt && !imageUrl && !isLoading) {
            const generate = async () => {
                setIsLoading(true);
                setError(null);
                try {
                    const apiKey = getApiKey();
                    if (!apiKey) throw new Error("API Key not found");
                    const result = await AiService.generateImage({
                        prompt: imageContent.prompt,
                        model: imageModel,
                        apiKey,
                        sessionId: sessionId, // Passa o sessionId
                    });
                    if (result?.imageUrl) {
                        setImageUrl(result.imageUrl);
                    } else {
                        throw new Error("A IA não retornou uma imagem.");
                    }
                } catch (err: any) {
                    setError(err.message || 'Falha ao gerar imagem.');
                } finally {
                    setIsLoading(false);
                }
            };
            generate();
        }
    }, [entry.content, imageUrl, isLoading, getApiKey, imageModel, sessionId]);

    const displayUrl = imageUrl || (typeof entry.content === 'object' && (entry.content as any).imageUrl) || null;

    return (
        <div className="my-4 rounded-lg overflow-hidden border-2 border-stone-600 shadow-lg">
            {displayUrl ? (
                <Image src={displayUrl} alt="Cena gerada pela IA" width={1024} height={576} className="w-full h-auto" />
            ) : (
                <div className="w-full aspect-video bg-stone-800 flex items-center justify-center text-stone-500">
                    {isLoading ? (
                        <>
                            <Loader2 className="h-8 w-8 mr-2 animate-spin"/> 
                            <span>Gerando imagem...</span>
                        </>
                    ) : (
                        <span>{error || 'Aguardando para gerar imagem...'}</span>
                    )}
                </div>
            )}
        </div>
    );
};

const NarrationEntry: React.FC<{ entry: LogEntryType }> = ({ entry }) => {
    let textContent = entry.content;
    
    // Defensive check: If content is a stringified JSON, parse it to get the actual text.
    if (typeof textContent === 'string') {
        try {
            const parsed = JSON.parse(textContent);
            // Check if parsing resulted in an object with a 'content' property
            if (typeof parsed === 'object' && parsed !== null && 'content' in parsed) {
                textContent = parsed.content;
            }
        } catch (e) {
            // Not a JSON string, which is the expected case. Do nothing.
        }
    }
    
    // Final check to ensure we have a renderable string.
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
        case 'image':
            contentComponent = <ImageEntry entry={entry} />;
            break;
        default:
             // If the type is unknown or invalid, render nothing.
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
