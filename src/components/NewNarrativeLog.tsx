// src/components/NewNarrativeLog.tsx
'use client';
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import type { LogEntry as LogEntryType } from '../types';
import { Swords, Wand, HeartPulse, Hand, Dice5, ChevronsRight, Sparkles, BrainCircuit, Volume2, Loader2 } from 'lucide-react';
import { useNarrationSpeech } from '@/hooks/useNarrationSpeech';
import { useToast } from '@/hooks/use-toast';
import { generateNarrationAudio } from '@/services/ttsService';
import clsx from 'clsx';

const extractEntryText = (value: any): string | null => {
    if (typeof value === 'string') {
        if (!value.trim()) return null;
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object') {
                if (typeof parsed.content === 'string') return parsed.content;
                if (typeof parsed.text === 'string') return parsed.text;
            }
        } catch {
            // plain string
        }
        return value;
    }
    if (value && typeof value === 'object') {
        if (typeof value.content === 'string') return value.content;
        if (typeof value.text === 'string') return value.text;
    }
    return null;
};

const NARRATABLE_TYPES: LogEntryType['type'][] = ['narration', 'system', 'combat', 'insight', 'roll'];

const isNarratableEntry = (entry?: LogEntryType | null) =>
    Boolean(entry && NARRATABLE_TYPES.includes(entry.type));

const getEntryAudioUrl = (entry: LogEntryType): string | undefined => {
    if (entry.audioUrl) return entry.audioUrl;
    if (entry.content && typeof entry.content === 'object' && entry.content.audioUrl) {
        return entry.content.audioUrl;
    }
    return undefined;
};

const NarrationEntry: React.FC<{
  entry: LogEntryType;
  onPlayAudio?: (entry: LogEntryType) => void;
  onGenerateAudio?: (entry: LogEntryType) => void;
  isGenerating?: boolean;
  prefix?: React.ReactNode;
  textClassName?: string;
}> = ({ entry, onPlayAudio, onGenerateAudio, isGenerating, prefix, textClassName }) => {
    const textContent = extractEntryText(entry.content);
    if (!textContent) return null;
    const audioUrl = getEntryAudioUrl(entry);
    return (
        <div className="flex items-start gap-2">
            {prefix ? <div className="flex-shrink-0 pt-1">{prefix}</div> : null}
            <p className={clsx("text-stone-300 leading-relaxed flex-grow font-sans", textClassName)}>
                {textContent}
            </p>
            {audioUrl ? (
              <button
                type="button"
                onClick={() => onPlayAudio?.(entry)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-stone-200 hover:text-amber-200 hover:border-amber-300/60 transition"
                title="Ouvir esta narração"
              >
                <Volume2 className="h-4 w-4" />
              </button>
            ) : (
              onGenerateAudio && (
                <button
                  type="button"
                  onClick={() => onGenerateAudio(entry)}
                  disabled={isGenerating}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-stone-200 hover:text-amber-200 hover:border-amber-300/60 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Gerar áudio para esta narração"
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                </button>
              )
            )}
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


const LogEntry = React.memo(function LogEntry({
    entry,
    onPlayAudio,
    onGenerateAudio,
    isGenerating,
}: {
    entry: LogEntryType;
    onPlayAudio?: (entry: LogEntryType) => void;
    onGenerateAudio?: (entry: LogEntryType) => void;
    isGenerating?: boolean;
}) {
    let contentComponent;

    // Ação interna do sistema, não deve ser renderizada.
    if (entry.type === 'action' && typeof entry.content === 'string' && (entry.content.startsWith("Recarregar estado atual") || entry.content.startsWith("A aventura começa.") || entry.content.includes("Gere uma resposta de Mestre de Jogo que demonstre todas as suas capacidades"))) {
        return null;
    }

    switch(entry.type) {
        case 'narration':
            contentComponent = (
                <NarrationEntry
                    entry={entry}
                    onPlayAudio={onPlayAudio}
                    onGenerateAudio={onGenerateAudio}
                    isGenerating={isGenerating}
                />
            );
            break;
        case 'action': {
             const actionText = extractEntryText(entry.content);
             if (actionText && actionText.trim()) {
                 contentComponent = (
                    <div className="flex items-start gap-3 my-4 py-3 border-y-2 border-stone-700/50">
                        <div className="flex-shrink-0 pt-1">{getActionIcon(actionText)}</div>
                        <p className="text-amber-400 font-semibold">{actionText}</p>
                    </div>
                );
             } else {
                 contentComponent = null;
             }
            break;
        }
        case 'roll':
            contentComponent = <RollEntry entry={entry} />;
            break;
        case 'system':
            contentComponent = (
                <NarrationEntry
                    entry={entry}
                    onPlayAudio={onPlayAudio}
                    onGenerateAudio={onGenerateAudio}
                    isGenerating={isGenerating}
                    prefix={<Sparkles className="h-4 w-4 text-yellow-500/80" />}
                    textClassName="text-yellow-500/80 italic"
                />
            );
            break;
        case 'combat':
            contentComponent = (
                <NarrationEntry
                    entry={entry}
                    onPlayAudio={onPlayAudio}
                    onGenerateAudio={onGenerateAudio}
                    isGenerating={isGenerating}
                    prefix={<Swords className="h-4 w-4 text-red-400" />}
                    textClassName="text-red-300 font-semibold"
                />
            );
            break;
        case 'insight':
            contentComponent = (
                <NarrationEntry
                    entry={entry}
                    onPlayAudio={onPlayAudio}
                    onGenerateAudio={onGenerateAudio}
                    isGenerating={isGenerating}
                    prefix={<BrainCircuit className="h-4 w-4 text-purple-300" />}
                    textClassName="text-purple-200 italic"
                />
            );
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
    const { log, setLog } = useGameStateContext();
    const logEndRef = useRef<HTMLDivElement>(null);
    const lastSpokenIdRef = useRef<string | null>(null);
    const audioElementRef = useRef<HTMLAudioElement | null>(null);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [generatingEntries, setGeneratingEntries] = useState<Record<string, boolean>>({});
    const { autoSpeak } = useNarrationSpeech();
    const { toast } = useToast();

    const setEntryGenerating = useCallback((entryId: string, value: boolean) => {
        setGeneratingEntries(prev => {
            if (prev[entryId] === value) return prev;
            if (value) {
                return { ...prev, [entryId]: true };
            }
            const next = { ...prev };
            delete next[entryId];
            return next;
        });
    }, []);

    const updateEntryAudio = useCallback(
        (entryId: string, audioUrl: string, fallbackText: string) => {
            setLog(prev =>
                prev.map(logEntry => {
                    if (logEntry.id !== entryId) return logEntry;
                    const nextContent =
                        typeof logEntry.content === 'string'
                            ? { content: logEntry.content, audioUrl }
                            : logEntry.content && typeof logEntry.content === 'object'
                            ? { ...logEntry.content, audioUrl }
                            : { content: fallbackText, audioUrl };
                    return { ...logEntry, audioUrl, content: nextContent };
                })
            );
        },
        [setLog]
    );

    const requestEntryAudio = useCallback(
        async (entry: LogEntryType, { silent = false }: { silent?: boolean } = {}) => {
            if (!entry?.id || !isNarratableEntry(entry)) return null;
            const textContent = extractEntryText(entry.content);
            if (!textContent) {
                if (!silent) {
                    toast({
                        variant: 'destructive',
                        description: 'Não foi possível encontrar texto para sintetizar.',
                    });
                }
                return null;
            }
            if (!silent) {
                setEntryGenerating(entry.id, true);
            }
            try {
                const { audioUrl } = await generateNarrationAudio(textContent);
                if (!audioUrl) {
                    throw new Error('Resposta sem URL de áudio');
                }
                updateEntryAudio(entry.id, audioUrl, textContent);
                (entry as any).audioUrl = audioUrl;
                if (entry.content && typeof entry.content === 'object') {
                    (entry.content as any).audioUrl = audioUrl;
                }
                if (!silent) {
                    toast({ description: 'Áudio gerado com sucesso.' });
                }
                return audioUrl;
            } catch (error) {
                console.error('[NewNarrativeLog] Falha ao gerar áudio de narração:', error);
                if (!silent) {
                    toast({
                        variant: 'destructive',
                        description: 'Não foi possível gerar o áudio agora. Tente novamente em instantes.',
                    });
                }
                return null;
            } finally {
                if (!silent) {
                    setEntryGenerating(entry.id, false);
                }
            }
        },
        [toast, setEntryGenerating, updateEntryAudio]
    );

    const ensureAudioForEntries = useCallback(
        async (entries: LogEntryType[]) => {
            for (const entry of entries) {
                if (!entry?.id || !isNarratableEntry(entry)) continue;
                if (getEntryAudioUrl(entry)) continue;
                await requestEntryAudio(entry, { silent: true });
            }
        },
        [requestEntryAudio]
    );

    const announceSpeechState = useCallback((active: boolean) => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('narration-speech', { detail: { active } }));
        }
    }, []);

    const stopAudioPlayback = useCallback(() => {
        if (audioElementRef.current) {
            audioElementRef.current.pause();
            audioElementRef.current.src = '';
            audioElementRef.current = null;
        }
        setIsAudioPlaying(false);
        announceSpeechState(false);
    }, [announceSpeechState]);

    useEffect(() => () => stopAudioPlayback(), [stopAudioPlayback]);

    type AudioQueueOptions = {
        onAutoPlayBlocked?: () => void;
    };

    const playAudioQueue = useCallback(
        (urls: string[], options?: AudioQueueOptions) => {
            if (!urls.length) return false;
            stopAudioPlayback();

            const audio = new Audio();
            audioElementRef.current = audio;
            let index = 0;

            const playNext = () => {
                if (!audioElementRef.current) return;
                if (index >= urls.length) {
                    stopAudioPlayback();
                    return;
                }
                const nextUrl = urls[index++];
                audioElementRef.current.src = nextUrl;
                audioElementRef.current
                    .play()
                    .then(() => {
                        setIsAudioPlaying(true);
                        announceSpeechState(true);
                    })
                    .catch(error => {
                        if ((error as DOMException)?.name === 'NotAllowedError') {
                            stopAudioPlayback();
                            options?.onAutoPlayBlocked?.();
                        } else {
                            console.warn('[NewNarrativeLog] Falha ao reproduzir áudio de narração:', error);
                            playNext();
                        }
                    });
            };

            audio.onended = () => playNext();
            audio.onerror = () => playNext();

            playNext();
            return true;
        },
        [stopAudioPlayback, announceSpeechState]
    );

    const currentBlock = useMemo(() => {
        if (!log?.length) return [] as LogEntryType[];
        let lastActionIndex = -1;
        for (let i = log.length - 1; i >= 0; i--) {
            if (log[i]?.type === 'action') {
                lastActionIndex = i;
                break;
            }
        }
        return log.slice(lastActionIndex + 1).filter(entry => entry && entry.type !== 'action') as LogEntryType[];
    }, [log]);

    useEffect(() => {
        if (!autoSpeak || !currentBlock.length) return;
        const lastEntryId = currentBlock[currentBlock.length - 1]?.id;
        if (!lastEntryId || lastSpokenIdRef.current === lastEntryId) return;

        const audioUrls = currentBlock.map(entry => getEntryAudioUrl(entry)).filter((url): url is string => Boolean(url));
        if (audioUrls.length) {
            const started = playAudioQueue(audioUrls);
            if (started) {
                lastSpokenIdRef.current = lastEntryId;
            }
        }
    }, [autoSpeak, currentBlock, playAudioQueue]);

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
    
    const handlePlayEntry = useCallback(
        (entry: LogEntryType) => {
            const audioUrl = getEntryAudioUrl(entry);
            if (!audioUrl) return;
            playAudioQueue([audioUrl]);
            lastSpokenIdRef.current = entry.id;
        },
        [playAudioQueue]
    );

    const handlePlayCurrentBlock = useCallback(async () => {
        if (!currentBlock.length) return;
        await ensureAudioForEntries(currentBlock.slice(-1));
        const lastEntryId = currentBlock[currentBlock.length - 1]?.id;
        const audioUrls = currentBlock.map(entry => getEntryAudioUrl(entry)).filter((url): url is string => Boolean(url));
        if (audioUrls.length) {
            playAudioQueue(audioUrls);
        }
        if (lastEntryId) {
            lastSpokenIdRef.current = lastEntryId;
        }
    }, [currentBlock, ensureAudioForEntries, playAudioQueue]);

    const handleStopNarration = useCallback(() => {
        stopAudioPlayback();
    }, [stopAudioPlayback]);

    useEffect(() => {
        const handlePlay = () => {
            void handlePlayCurrentBlock();
        };
        const handleStop = () => handleStopNarration();
        window.addEventListener('narration-play-request', handlePlay as EventListener);
        window.addEventListener('narration-stop-request', handleStop as EventListener);
        return () => {
            window.removeEventListener('narration-play-request', handlePlay as EventListener);
            window.removeEventListener('narration-stop-request', handleStop as EventListener);
        };
    }, [handlePlayCurrentBlock, handleStopNarration]);

    const handleGenerateAudio = useCallback(
        async (entry: LogEntryType) => {
            await requestEntryAudio(entry);
        },
        [requestEntryAudio]
    );

    return (
        <div className="space-y-4">
            <NpcRollDisplay />

            {log.map((entry) => {
                if(!entry || !entry.id) return null;
                return (
                    <LogEntry
                        key={entry.id}
                        entry={entry}
                        onPlayAudio={handlePlayEntry}
                        onGenerateAudio={handleGenerateAudio}
                        isGenerating={Boolean(generatingEntries[entry.id])}
                    />
                );
            })}
            <div ref={logEndRef} />
        </div>
    );
};

export default NewNarrativeLog;
