// src/components/NewNarrativeLog.tsx
'use client';
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import { Button } from './ui/button';
import type { LogEntry as LogEntryType, ImageLogEntryContent } from '../types';
import { Swords, Wand, HeartPulse, Hand, Dice5, ChevronsRight, Sparkles, BrainCircuit, Volume2, VolumeX, Loader2, Image as ImageIcon, RefreshCcw } from 'lucide-react';
import { useNarrationSpeech } from '@/hooks/useNarrationSpeech';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { getPlaybackRateForSpeed, buildNarrationTtsCacheKey } from '@/lib/narrationTts';
import { useToast } from '@/hooks/use-toast';
import {
    generateNarrationAudio,
    resolveNarrationPlaybackUrl,
    withPlaybackAuthToken,
} from '@/services/ttsService';
import { generateSceneImage, getSignedImageUrl } from '@/services/imageService';
import clsx from 'clsx';
import { DndButton, DndCard } from '@/components/primitives';
import { NarrativeBeatCard } from '@/components/cinematic';
import type { NarrativeBeatVisual } from '@/lib/cinematicAssets';
import {
  NarrativeLogVariantProvider,
  useNarrativeLogVariant,
  type NarrativeLogVariant,
} from '@/features/gameplay/narrative/narrativeLogVariant';

const IMAGE_FEATURE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_IMAGE_GENERATION === 'true';

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

/** Pausa antes da primeira narração ao abrir/entrar na sessão (ms). */
const AUTO_SPEAK_ENTER_DELAY_MS = 3000;

const isNarratableEntry = (entry?: LogEntryType | null) =>
    Boolean(entry && NARRATABLE_TYPES.includes(entry.type));

const getLastNarratableEntry = (entries: LogEntryType[]): LogEntryType | null => {
    for (let i = entries.length - 1; i >= 0; i--) {
        if (isNarratableEntry(entries[i])) return entries[i];
    }
    return null;
};

const getEntryAudioUrl = (entry: LogEntryType, cache?: Record<string, string>): string | undefined => {
    if (entry.audioUrl) return entry.audioUrl;
    if (entry.content && typeof entry.content === 'object' && entry.content.audioUrl) {
        return entry.content.audioUrl;
    }
    if (cache) return cache[entry.id];
    return undefined;
};

const getEntryAudioKey = (entry: LogEntryType): string | undefined => {
    if (entry.audioKey) return entry.audioKey;
    if (entry.content && typeof entry.content === 'object' && entry.content.audioKey) {
        return entry.content.audioKey;
    }
    return undefined;
};

const NarrationEntry: React.FC<{
  entry: LogEntryType;
  onPlayAudio?: (entry: LogEntryType) => void;
  onGenerateAudio?: (entry: LogEntryType) => void;
  isGenerating?: boolean;
  isPlaying?: boolean;
  prefix?: React.ReactNode;
  textClassName?: string;
  /** Evita card duplo quando já está dentro de NarrativeBeatCard. */
  bare?: boolean;
}> = ({ entry, onPlayAudio, onGenerateAudio, isGenerating, isPlaying = false, prefix, textClassName, bare = false }) => {
    const variant = useNarrativeLogVariant();
    const isV2 = variant === 'v2';
    const textContent = extractEntryText(entry.content);
    if (!textContent) return null;
    const audioUrl = getEntryAudioUrl(entry);
    const hasAudio = Boolean(audioUrl || getEntryAudioKey(entry));

    const ttsBtn = hasAudio ? (
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          e.preventDefault();
          void onPlayAudio?.(entry);
        }}
        className={clsx(
          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition',
          isPlaying
            ? isV2
              ? 'border-dnd-ember/50 bg-dnd-ember/20 text-dnd-ember'
              : 'border-amber-400/60 bg-amber-500/20 text-amber-200'
            : isV2
              ? 'border-dnd-gold/30 text-dnd-gold hover:bg-dnd-gold/15'
              : 'border-white/15 text-stone-200 hover:text-amber-200 hover:border-amber-300/60'
        )}
        title={isPlaying ? 'Parar esta narração' : 'Ouvir esta narração'}
        aria-pressed={isPlaying}
      >
        {isPlaying ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
    ) : onGenerateAudio ? (
      <button
        type="button"
        onClick={() => onGenerateAudio(entry)}
        disabled={isGenerating}
        className={clsx(
          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-40',
          isV2
            ? 'border-dnd-gold/30 text-dnd-parchment-muted hover:text-dnd-gold'
            : 'border-white/15 text-stone-200 hover:text-amber-200'
        )}
        title="Gerar áudio para esta narração"
      >
        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
      </button>
    ) : null;

    const inner = (
      <div className="flex items-start gap-2">
        {prefix ? <div className="shrink-0 pt-0.5">{prefix}</div> : null}
        <p
          className={clsx(
            'flex-grow leading-relaxed',
            isV2
              ? 'font-narrative text-base text-dnd-parchment md:text-lg'
              : clsx('font-sans text-stone-300', textClassName)
          )}
        >
          {textContent}
        </p>
        {ttsBtn}
      </div>
    );

    if (isV2 && !bare) {
      return <NarrativeBeatCard type="narration">{inner}</NarrativeBeatCard>;
    }
    return inner;
};

const BeatNarrationEntry: React.FC<{
  beatType: NarrativeBeatVisual;
  entry: LogEntryType;
  onPlayAudio?: (entry: LogEntryType) => void;
  onGenerateAudio?: (entry: LogEntryType) => void;
  isGenerating?: boolean;
  isPlaying?: boolean;
  prefix?: React.ReactNode;
  textClassName?: string;
}> = (props) => {
  const variant = useNarrativeLogVariant();
  if (variant !== 'v2') {
    return (
      <NarrationEntry
        entry={props.entry}
        onPlayAudio={props.onPlayAudio}
        onGenerateAudio={props.onGenerateAudio}
        isGenerating={props.isGenerating}
        isPlaying={props.isPlaying}
        prefix={props.prefix}
        textClassName={props.textClassName}
      />
    );
  }
  return (
    <NarrativeBeatCard type={props.beatType}>
      <NarrationEntry
        bare
        entry={props.entry}
        onPlayAudio={props.onPlayAudio}
        onGenerateAudio={props.onGenerateAudio}
        isGenerating={props.isGenerating}
        isPlaying={props.isPlaying}
        prefix={props.prefix}
        textClassName={props.textClassName}
      />
    </NarrativeBeatCard>
  );
};

const RollEntry: React.FC<{ entry: LogEntryType }> = ({ entry }) => {
    const isV2 = useNarrativeLogVariant() === 'v2';
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

    const inner = (
            <div className="relative space-y-3">
                <div className={clsx(
                  'flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest',
                  isV2 ? 'font-ui text-dnd-parchment-muted' : 'text-stone-400'
                )}>
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
                <div className={clsx(
                  'rounded-lg border p-3 font-mono text-sm',
                  isV2 ? 'border-dnd-gold/15 bg-dnd-obsidian text-dnd-parchment' : 'border-white/10 bg-black/40 text-stone-200'
                )}>
                    <p>
                        {dice} ({rollsText}) {modifier ? (modifier >= 0 ? `+ ${modifier}` : `- ${Math.abs(modifier || 0)}`) : ''} ={' '}
                        <span className="text-2xl font-bold">{total}</span>
                    </p>
                </div>
            </div>
    );

    if (isV2) {
      return (
        <DndCard padding="md" hover={false} className={clsx('relative overflow-hidden border', palette.border)}>
          <div className={clsx('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60', palette.gradient)} aria-hidden />
          <div className="relative">{inner}</div>
        </DndCard>
      );
    }

    return (
      <div className={clsx('relative overflow-hidden rounded-2xl border p-4 text-sm shadow-lg', palette.border, 'bg-black/40')}>
        <div className={clsx('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80', palette.gradient)} aria-hidden />
        {inner}
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

const ImageEntry: React.FC<{
    entry: LogEntryType;
    onGenerateImage?: (entry: LogEntryType) => void;
    onRefreshImage?: (entry: LogEntryType) => void;
    isLoading?: boolean;
}> = ({ entry, onGenerateImage, onRefreshImage, isLoading }) => {
    const isV2 = useNarrativeLogVariant() === 'v2';
    if (entry.type !== 'image' || !entry.content || typeof entry.content !== 'object') return null;
    const content = entry.content as ImageLogEntryContent;
    const hasPrompt = Boolean(content.prompt && content.prompt.trim().length);
    const promptText = content.prompt ?? 'Cena sugerida pelo mestre.';
    const imageUrl = content.imageUrl ?? content.url;
    const status = content.status;
    const showImage = status === 'done' && Boolean(imageUrl);
    const canRefresh = Boolean(content.imageKey && onRefreshImage);
    const canGenerate = Boolean(onGenerateImage && hasPrompt);

    const statusBadge = (() => {
        switch (status) {
            case 'generating':
                return (
                    <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando
                    </span>
                );
            case 'failed':
                return (
                    <span className="inline-flex items-center rounded-full border border-rose-400/40 bg-rose-500/10 px-2 py-0.5 text-xs text-rose-200">
                        Falhou
                    </span>
                );
            case 'done':
                return (
                    <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-200">
                        Concluída
                    </span>
                );
            default:
                return null;
        }
    })();

    const imgBody = (
      <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <div className={clsx(
                      'flex items-center gap-2 text-xs uppercase tracking-widest',
                      isV2 ? 'font-ui text-dnd-parchment-muted' : 'text-stone-400'
                    )}>
                        <ImageIcon className="h-4 w-4" />
                        Visual da Cena
                        {statusBadge}
                    </div>
                    <p className={clsx('text-sm', isV2 ? 'text-dnd-parchment' : 'text-stone-300')}>{promptText}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {canGenerate && (isV2 ? (
                        <DndButton
                            variant="goldOutline"
                            size="sm"
                            disabled={isLoading || status === 'generating'}
                            onClick={() => onGenerateImage?.(entry)}
                            title="Solicitar uma nova imagem para esta cena"
                        >
                            {isLoading && status === 'generating' ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Sparkles className="h-4 w-4" />
                            )}
                            {status === 'done' ? 'Gerar novamente' : 'Gerar imagem'}
                        </DndButton>
                    ) : (
                        <button
                            type="button"
                            disabled={isLoading || status === 'generating'}
                            onClick={() => onGenerateImage?.(entry)}
                            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-sm text-stone-100 transition hover:border-amber-300/60 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Solicitar uma nova imagem para esta cena"
                        >
                            {isLoading && status === 'generating' ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Sparkles className="h-4 w-4" />
                            )}
                            {status === 'done' ? 'Gerar novamente' : 'Gerar imagem'}
                        </button>
                    ))}
                    {canRefresh && (
                        isV2 ? (
                          <DndButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isLoading}
                            onClick={() => onRefreshImage?.(entry)}
                            title="Atualizar a URL assinada desta imagem"
                          >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                            Atualizar link
                          </DndButton>
                        ) : (
                        <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => onRefreshImage?.(entry)}
                            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-sm text-stone-100 transition hover:border-cyan-300/60 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Atualizar a URL assinada desta imagem"
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                            Atualizar link
                        </button>
                        )
                    )}
                </div>
            </div>
            {status === 'failed' && (
                <div className={clsx(
                  'rounded-lg border p-3 text-sm',
                  isV2 ? 'border-dnd-ember/40 bg-dnd-ember/10 text-dnd-parchment' : 'border-rose-500/30 bg-rose-950/40 text-rose-200'
                )}>
                    {content.error ?? 'Falha ao gerar a imagem.'}
                </div>
            )}
            {status === 'generating' && (
                <div className={clsx('flex items-center gap-2 text-sm', isV2 ? 'text-dnd-gold' : 'text-amber-200')}>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando imagem com o Gemini...
                </div>
            )}
            {showImage && imageUrl && (
                <a
                    href={imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={clsx(
                      'block overflow-hidden rounded-lg border',
                      isV2 ? 'border-dnd-gold/20 bg-dnd-obsidian' : 'border-white/10 bg-black/60'
                    )}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt={promptText} className="w-full object-cover" loading="lazy" />
                </a>
            )}
            {status === 'done' && !imageUrl && (
                <p className={clsx('text-sm', isV2 ? 'text-dnd-parchment-muted' : 'text-stone-400')}>
                    A URL temporária desta imagem expirou. Clique em &quot;Atualizar link&quot; para gerar outra.
                </p>
            )}
            {content.completedAt && (
                <p className={clsx('text-xs', isV2 ? 'text-dnd-parchment-muted/70' : 'text-stone-500')}>
                    Gerado em {new Date(content.completedAt).toLocaleString()}
                </p>
            )}
      </>
    );

    if (isV2) {
      return (
        <DndCard padding="md" hover={false} className="space-y-4 border-dnd-gold/12">
          {imgBody}
        </DndCard>
      );
    }

    return (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-stone-950/70 p-4 shadow-lg">
          {imgBody}
        </div>
    );
};


const LogEntry = React.memo(function LogEntry({
    entry,
    onPlayAudio,
    onGenerateAudio,
    isGenerating,
    onGenerateImage,
    onRefreshImage,
    isImageLoading,
    playingEntryId,
}: {
    entry: LogEntryType;
    onPlayAudio?: (entry: LogEntryType) => void;
    onGenerateAudio?: (entry: LogEntryType) => void;
    isGenerating?: boolean;
    onGenerateImage?: (entry: LogEntryType) => void;
    onRefreshImage?: (entry: LogEntryType) => void;
    isImageLoading?: boolean;
    playingEntryId?: string | null;
}) {
    const isV2 = useNarrativeLogVariant() === 'v2';
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
                    isPlaying={playingEntryId === entry.id}
                />
            );
            break;
        case 'action': {
             const actionText = extractEntryText(entry.content);
             if (actionText && actionText.trim()) {
                 contentComponent = isV2 ? (
                    <NarrativeBeatCard type="action">
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 pt-0.5">{getActionIcon(actionText)}</div>
                        <p className="font-ui text-sm font-semibold text-dnd-gold">{actionText}</p>
                      </div>
                    </NarrativeBeatCard>
                 ) : (
                    <div className="my-4 flex items-start gap-3 border-y-2 border-stone-700/50 py-3">
                        <div className="shrink-0 pt-1">{getActionIcon(actionText)}</div>
                        <p className="font-semibold text-amber-400">{actionText}</p>
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
                <BeatNarrationEntry
                    beatType="system"
                    entry={entry}
                    onPlayAudio={onPlayAudio}
                    onGenerateAudio={onGenerateAudio}
                    isGenerating={isGenerating}
                    isPlaying={playingEntryId === entry.id}
                    prefix={<Sparkles className="h-4 w-4 text-dnd-gold/90" />}
                    textClassName="text-dnd-gold/90 italic"
                />
            );
            break;
        case 'combat':
            contentComponent = (
                <BeatNarrationEntry
                    beatType="combat"
                    entry={entry}
                    onPlayAudio={onPlayAudio}
                    onGenerateAudio={onGenerateAudio}
                    isGenerating={isGenerating}
                    isPlaying={playingEntryId === entry.id}
                    prefix={<Swords className="h-4 w-4 text-dnd-ember" />}
                    textClassName="text-dnd-parchment font-semibold"
                />
            );
            break;
        case 'insight':
            contentComponent = (
                <BeatNarrationEntry
                    beatType="insight"
                    entry={entry}
                    onPlayAudio={onPlayAudio}
                    onGenerateAudio={onGenerateAudio}
                    isGenerating={isGenerating}
                    isPlaying={playingEntryId === entry.id}
                    prefix={<BrainCircuit className="h-4 w-4 text-purple-300" />}
                    textClassName="text-purple-200/90 italic"
                />
            );
            break;
        case 'image':
            contentComponent = (
                <ImageEntry
                    entry={entry}
                    onGenerateImage={onGenerateImage}
                    onRefreshImage={onRefreshImage}
                    isLoading={isImageLoading}
                />
            );
            break;
        default:
             contentComponent = null;
    }
    
    if(contentComponent === null) return null;

    const stateVersionBadge = typeof entry.stateVersion === 'number'
        ? (
            <span className="pointer-events-none absolute -bottom-1 left-0 text-[9px] uppercase tracking-[0.4em] text-stone-500/60">
                v{entry.stateVersion}
            </span>
        )
        : null;

    return (
        <div className="relative animate-fadeIn pb-4" style={{ animationDuration: '500ms' }}>
            {contentComponent}
            {stateVersionBadge}
        </div>
    );
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

const PendingRollBanner: React.FC = () => {
    const { isRollPending, playerRollRequest, actionPhaseLabel } = useGameStateContext();
    const isV2 = useNarrativeLogVariant() === 'v2';
    if (!isRollPending || !playerRollRequest) return null;

    const reason = playerRollRequest.reason || playerRollRequest.skillName || 'Teste pendente';

    const openDice = () => window.dispatchEvent(new CustomEvent('game-focus-roll-modal'));

    const inner = (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className={clsx('flex items-start gap-2', isV2 ? 'text-dnd-parchment' : 'text-amber-100')}>
          <Dice5 className={clsx('mt-0.5 h-5 w-5 shrink-0', isV2 ? 'text-dnd-gold' : 'text-amber-300')} />
          <div>
            <p className={clsx('text-sm font-semibold', isV2 && 'font-ui text-dnd-gold')}>Rolagem pendente</p>
            <p className={clsx('mt-0.5 text-xs', isV2 ? 'text-dnd-parchment-muted' : 'text-amber-200/90')}>{reason}</p>
            {actionPhaseLabel ? (
              <p className={clsx('mt-1 text-xs', isV2 ? 'text-dnd-parchment-muted/80' : 'text-amber-300/70')}>
                {actionPhaseLabel}
              </p>
            ) : null}
          </div>
        </div>
        {isV2 ? (
          <DndButton variant="ember" size="sm" className="shrink-0" onClick={openDice}>
            Abrir dados
          </DndButton>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="shrink-0 border-amber-400/40 bg-amber-900/60 text-amber-50 hover:bg-amber-800"
            onClick={openDice}
          >
            Abrir dados
          </Button>
        )}
      </div>
    );

    if (isV2) {
      return (
        <div className="sticky top-0 z-10 mb-4">
          <DndCard padding="sm" hover={false} className="border-dnd-gold/30 bg-dnd-obsidian-raised/80 backdrop-blur-sm">
            {inner}
          </DndCard>
        </div>
      );
    }

    return (
      <div className="sticky top-0 z-10 mb-4 rounded-lg border border-amber-500/50 bg-amber-950/80 px-4 py-3 shadow-lg backdrop-blur-sm">
        {inner}
      </div>
    );
};

export type NewNarrativeLogProps = {
  variant?: NarrativeLogVariant;
};

const NewNarrativeLog: React.FC<NewNarrativeLogProps> = ({ variant = 'legacy' }) => {
    const { log, setLog, sessionId } = useGameStateContext();
    const logEndRef = useRef<HTMLDivElement>(null);
    const lastSpokenIdRef = useRef<string | null>(null);
    const needsEnterDelayRef = useRef(true);
    const audioElementRef = useRef<HTMLAudioElement | null>(null);
    const suppressAutoSpeakRef = useRef(false);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [playingEntryId, setPlayingEntryId] = useState<string | null>(null);
    const [generatingEntries, setGeneratingEntries] = useState<Record<string, boolean>>({});
    const [imageLoadingEntries, setImageLoadingEntries] = useState<Record<string, boolean>>({});
    const [audioUrlCache, setAudioUrlCache] = useState<Record<string, string[]>>({});
    const { autoSpeak } = useNarrationSpeech();
    const { toast } = useToast();
    const { volume, isMuted, narrationVoice, narrationSpeed } = useSettingsContext();
    const narrationPlaybackRate = useMemo(
        () => getPlaybackRateForSpeed(narrationSpeed),
        [narrationSpeed],
    );

    const applyNarrationAudioPrefs = useCallback(
        (audio: HTMLAudioElement) => {
            audio.playbackRate = narrationPlaybackRate;
            audio.volume = isMuted ? 0 : volume;
        },
        [narrationPlaybackRate, isMuted, volume],
    );

    useEffect(() => {
        if (audioElementRef.current) {
            applyNarrationAudioPrefs(audioElementRef.current);
        }
    }, [applyNarrationAudioPrefs]);

    const getEntryTtsCacheKey = useCallback(
        (entryId: string) => buildNarrationTtsCacheKey(entryId, narrationVoice, narrationSpeed),
        [narrationVoice, narrationSpeed],
    );

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

    const setImageEntryLoading = useCallback((entryId: string, value: boolean) => {
        setImageLoadingEntries(prev => {
            if (value) {
                return { ...prev, [entryId]: true };
            }
            const next = { ...prev };
            delete next[entryId];
            return next;
        });
    }, []);

    const updateImageEntry = useCallback(
        (entryId: string, patch: Partial<ImageLogEntryContent>) => {
            setLog(prev =>
                prev.map(logEntry => {
                    if (logEntry.id !== entryId || logEntry.type !== 'image') return logEntry;
                    if (!logEntry.content || typeof logEntry.content !== 'object') return logEntry;
                    const nextContent: ImageLogEntryContent = {
                        ...(logEntry.content as ImageLogEntryContent),
                        ...patch,
                    };
                    return { ...logEntry, content: nextContent };
                })
            );
        },
        [setLog]
    );

    const updateEntryAudio = useCallback(
        (entryId: string, audioUrl: string, fallbackText: string, audioKey?: string) => {
            setLog(prev =>
                prev.map(logEntry => {
                    if (logEntry.id !== entryId) return logEntry;
                    const nextContent =
                        typeof logEntry.content === 'string'
                            ? { content: logEntry.content, audioUrl, audioKey: audioKey ?? getEntryAudioKey(logEntry) }
                            : logEntry.content && typeof logEntry.content === 'object'
                            ? { ...logEntry.content, audioUrl, audioKey: audioKey ?? (logEntry.content as any).audioKey }
                            : { content: fallbackText, audioUrl, audioKey };
                    return { ...logEntry, audioUrl, audioKey: audioKey ?? logEntry.audioKey, content: nextContent };
                })
            );
            setAudioUrlCache(prev => ({ ...prev, [getEntryTtsCacheKey(entryId)]: [audioUrl] }));
        },
        [setLog, getEntryTtsCacheKey],
    );

    const splitNarrationByPunctuation = useCallback((text: string) => {
        const chunks = String(text)
            .replace(/\s+/g, ' ')
            .trim()
            .match(/[^,.!?…]+[,.!?…]?/g);

        const items = (chunks ?? [text])
            .map(s => s.trim())
            .filter(Boolean)
            .map(segment => {
                const last = segment.slice(-1);
                const pauseMs =
                    last === ','
                        ? 360
                        : last === '.' || last === '!' || last === '?' || last === '…'
                          ? 650
                          : 0;
                return { segment, pauseMs };
            });

        return items.length ? items : [{ segment: text, pauseMs: 0 }];
    }, []);

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
                const parts = splitNarrationByPunctuation(textContent);
                const urls: string[] = [];
                let firstKey: string | undefined;

                for (const part of parts) {
                    const { audioUrl, audioKey } = await generateNarrationAudio(part.segment, {
                        narrationVoice,
                        narrationSpeed,
                    });
                    if (!audioUrl || !audioKey) {
                        throw new Error('Resposta sem URL de áudio');
                    }
                    if (!firstKey) firstKey = audioKey;
                    urls.push(audioUrl);
                }

                // Compat: mantém audioUrl/audioKey no log, mas o player usa a fila (cache).
                updateEntryAudio(entry.id, urls[0]!, textContent, firstKey);
                setAudioUrlCache(prev => ({ ...prev, [getEntryTtsCacheKey(entry.id)]: urls }));

                (entry as any).audioUrl = urls[0];
                (entry as any).audioKey = firstKey;
                if (entry.content && typeof entry.content === 'object') {
                    (entry.content as any).audioUrl = urls[0];
                    (entry.content as any).audioKey = firstKey;
                }
                if (!silent) {
                    toast({ description: 'Áudio gerado com sucesso.' });
                }
                return urls;
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
        [toast, setEntryGenerating, updateEntryAudio, narrationVoice, narrationSpeed, splitNarrationByPunctuation, getEntryTtsCacheKey]
    );

    const resolveEntryPlaybackUrl = useCallback(
        (entry: LogEntryType) => {
            const cacheKey = getEntryTtsCacheKey(entry.id);
            const cached = audioUrlCache[cacheKey];
            if (cached?.length) return cached.map(withPlaybackAuthToken);
            const audioKey = getEntryAudioKey(entry);
            const resolved = resolveNarrationPlaybackUrl(audioKey, getEntryAudioUrl(entry));
            if (resolved && entry.id) {
                setAudioUrlCache(prev => ({ ...prev, [cacheKey]: [resolved] }));
            }
            return resolved ? [resolved] : null;
        },
        [audioUrlCache, getEntryTtsCacheKey],
    );

    const ensurePlayableAudio = useCallback(
        async (entry: LogEntryType, opts: { silent?: boolean } = {}) => {
            const cacheKey = getEntryTtsCacheKey(entry.id);
            const cached = audioUrlCache[cacheKey];
            if (cached?.length) return cached.map(withPlaybackAuthToken);

            const regeneratedUrls = await requestEntryAudio(entry, { silent: opts.silent ?? true });
            if (regeneratedUrls?.length) return regeneratedUrls.map(withPlaybackAuthToken);

            const existingUrl = getEntryAudioUrl(entry, audioUrlCache);
            return existingUrl ? [withPlaybackAuthToken(existingUrl)] : null;
        },
        [audioUrlCache, getEntryTtsCacheKey, requestEntryAudio],
    );

    const ensureAudioForEntries = useCallback(
        async (entries: LogEntryType[]) => {
            for (const entry of entries) {
                if (!entry?.id || !isNarratableEntry(entry)) continue;
                const cacheKey = getEntryTtsCacheKey(entry.id);
                if (audioUrlCache[cacheKey]?.length) continue;
                await requestEntryAudio(entry, { silent: true });
            }
        },
        [audioUrlCache, getEntryTtsCacheKey, requestEntryAudio],
    );

    const announceSpeechState = useCallback((active: boolean) => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('narration-speech', { detail: { active } }));
        }
    }, []);

    const stopAudioPlayback = useCallback(() => {
        if (audioElementRef.current) {
            audioElementRef.current.pause();
            audioElementRef.current.onended = null;
            audioElementRef.current.onerror = null;
            audioElementRef.current.src = '';
            audioElementRef.current = null;
        }
        setIsAudioPlaying(false);
        setPlayingEntryId(null);
        announceSpeechState(false);
    }, [announceSpeechState]);

    useEffect(() => () => stopAudioPlayback(), [stopAudioPlayback]);

    useEffect(() => {
        needsEnterDelayRef.current = true;
        lastSpokenIdRef.current = null;
    }, [sessionId]);

    type AudioQueueOptions = {
        onAutoPlayBlocked?: () => void;
    };

    type QueueItem = { url: string; delayMs?: number };

    const playAudioQueue = useCallback(
        (items: Array<string | QueueItem>, options?: AudioQueueOptions) => {
            if (!items.length) return false;
            stopAudioPlayback();

            const audio = new Audio();
            applyNarrationAudioPrefs(audio);
            audioElementRef.current = audio;
            let index = 0;

            const playNext = () => {
                if (!audioElementRef.current) return;
                if (index >= items.length) {
                    stopAudioPlayback();
                    return;
                }
                const next = items[index++];
                const nextUrl = typeof next === 'string' ? next : next.url;
                const defaultGapMs = index < items.length ? 420 : 0;
                const delayMs = typeof next === 'string' ? defaultGapMs : next.delayMs ?? defaultGapMs;
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

                // Pausa extra entre trechos (pontuação).
                if (delayMs > 0) {
                    audioElementRef.current.onended = () => setTimeout(() => playNext(), delayMs);
                } else {
                    audioElementRef.current.onended = () => playNext();
                }
            };

            audio.onended = () => playNext();
            audio.onerror = () => playNext();

            playNext();
            return true;
        },
        [stopAudioPlayback, announceSpeechState, applyNarrationAudioPrefs]
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

    const playSingleEntryAudio = useCallback(
        async (entry: LogEntryType) => {
            if (!entry?.id || !isNarratableEntry(entry)) return;

            if (playingEntryId === entry.id && audioElementRef.current && !audioElementRef.current.paused) {
                stopAudioPlayback();
                suppressAutoSpeakRef.current = false;
                return;
            }

            const audioUrls = await ensurePlayableAudio(entry, { silent: false });
            if (!audioUrls?.length) {
                toast({
                    variant: 'destructive',
                    description: 'Não foi possível carregar o áudio desta narração.',
                });
                return;
            }

            suppressAutoSpeakRef.current = true;
            if (audioElementRef.current) {
                audioElementRef.current.pause();
                audioElementRef.current.onended = null;
                audioElementRef.current.onerror = null;
                audioElementRef.current.src = '';
                audioElementRef.current = null;
            }

            const audio = new Audio(audioUrls[0]!);
            applyNarrationAudioPrefs(audio);
            audioElementRef.current = audio;
            setPlayingEntryId(entry.id);
            lastSpokenIdRef.current = entry.id;

            audio.onended = () => {
                stopAudioPlayback();
                suppressAutoSpeakRef.current = false;
            };
            audio.onerror = () => {
                console.warn('[NewNarrativeLog] Erro ao reproduzir narração:', audioUrls[0]);
                stopAudioPlayback();
                suppressAutoSpeakRef.current = false;
                toast({
                    variant: 'destructive',
                    description: 'Falha ao reproduzir o áudio desta narração.',
                });
            };

            try {
                // Se vier mais de um trecho, toca como fila (com pausas).
                if (audioUrls.length > 1) {
                    stopAudioPlayback();
                    playAudioQueue(
                        audioUrls.map((url, idx) => ({ url, delayMs: idx === audioUrls.length - 1 ? 0 : 420 })),
                    );
                    return;
                }
                await audio.play();
                setIsAudioPlaying(true);
                announceSpeechState(true);
            } catch (error) {
                console.warn('[NewNarrativeLog] play() bloqueado ou falhou:', error);
                stopAudioPlayback();
                suppressAutoSpeakRef.current = false;
                toast({
                    variant: 'destructive',
                    description: 'O navegador bloqueou a reprodução. Tente clicar de novo.',
                });
            }
        },
        [playingEntryId, ensurePlayableAudio, stopAudioPlayback, announceSpeechState, toast, applyNarrationAudioPrefs, playAudioQueue],
    );

    useEffect(() => {
        if (!autoSpeak || !currentBlock.length || suppressAutoSpeakRef.current) return;
        const controller = { cancelled: false };

        (async () => {
            const lastEntry = getLastNarratableEntry(currentBlock);
            if (!lastEntry?.id || lastSpokenIdRef.current === lastEntry.id) return;

            if (needsEnterDelayRef.current) {
                await new Promise<void>(resolve => {
                    setTimeout(resolve, AUTO_SPEAK_ENTER_DELAY_MS);
                });
                needsEnterDelayRef.current = false;
                if (controller.cancelled) return;
            }

            await ensureAudioForEntries([lastEntry]);
            if (controller.cancelled) return;
            const urls = await ensurePlayableAudio(lastEntry);
            if (controller.cancelled || !urls?.length) return;

            const started = playAudioQueue(urls);
            if (started) {
                lastSpokenIdRef.current = lastEntry.id;
                setPlayingEntryId(lastEntry.id);
            }
            suppressAutoSpeakRef.current = false;
        })();

        return () => {
            controller.cancelled = true;
        };
    }, [autoSpeak, currentBlock, ensureAudioForEntries, ensurePlayableAudio, playAudioQueue]);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [log]);

    const handlePlayEntry = useCallback(
        (entry: LogEntryType) => playSingleEntryAudio(entry),
        [playSingleEntryAudio],
    );

    const handlePlayCurrentBlock = useCallback(async () => {
        const lastEntry = getLastNarratableEntry(currentBlock);
        if (!lastEntry?.id) return;
        suppressAutoSpeakRef.current = true;
        await ensureAudioForEntries([lastEntry]);
        const urls = await ensurePlayableAudio(lastEntry);
        if (urls?.length) {
            playAudioQueue(urls);
            lastSpokenIdRef.current = lastEntry.id;
            setPlayingEntryId(lastEntry.id);
        }
        suppressAutoSpeakRef.current = false;
    }, [currentBlock, ensureAudioForEntries, ensurePlayableAudio, playAudioQueue]);

    const handleStopNarration = useCallback(() => {
        suppressAutoSpeakRef.current = false;
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

    const handleGenerateImageEntry = useCallback(
        async (entry: LogEntryType) => {
            if (!IMAGE_FEATURE_ENABLED) return;
            if (!entry?.id || entry.type !== 'image') return;
            const content = entry.content && typeof entry.content === 'object' ? (entry.content as ImageLogEntryContent) : null;
            const prompt = content?.prompt;
            if (!prompt) {
                toast({
                    variant: 'destructive',
                    description: 'Não há prompt disponível para gerar esta imagem.',
                });
                return;
            }
            setImageEntryLoading(entry.id, true);
            updateImageEntry(entry.id, {
                status: 'generating',
                error: undefined,
                requestedAt: new Date().toISOString(),
            });
            try {
                const result = await generateSceneImage(prompt);
                updateImageEntry(entry.id, {
                    status: 'done',
                    imageUrl: result.imageUrl,
                    url: result.imageUrl,
                    imageKey: result.imageKey,
                    size: result.size,
                    contentType: result.contentType,
                    completedAt: new Date().toISOString(),
                });
                toast({
                    title: 'Imagem gerada',
                    description: 'A nova ilustração foi adicionada ao diário.',
                });
            } catch (error) {
                console.warn('[NewNarrativeLog] Falha ao gerar imagem:', error);
                updateImageEntry(entry.id, {
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Falha ao gerar imagem.',
                });
                toast({
                    variant: 'destructive',
                    title: 'Erro ao gerar imagem',
                    description:
                        error instanceof Error
                            ? error.message
                            : 'O servidor não conseguiu gerar a imagem solicitada.',
                });
            } finally {
                setImageEntryLoading(entry.id, false);
            }
        },
        [setImageEntryLoading, toast, updateImageEntry]
    );

    const handleRefreshImageEntry = useCallback(
        async (entry: LogEntryType) => {
            if (!IMAGE_FEATURE_ENABLED) return;
            if (!entry?.id || entry.type !== 'image') return;
            const content = entry.content && typeof entry.content === 'object' ? (entry.content as ImageLogEntryContent) : null;
            const key = content?.imageKey;
            if (!key) {
                toast({
                    variant: 'destructive',
                    description: 'Não foi possível atualizar o link desta imagem.',
                });
                return;
            }
            setImageEntryLoading(entry.id, true);
            try {
                const { imageUrl } = await getSignedImageUrl(key);
                updateImageEntry(entry.id, {
                    imageUrl,
                    url: imageUrl,
                });
                toast({
                    description: 'Link da imagem atualizado.',
                });
            } catch (error) {
                console.warn('[NewNarrativeLog] Falha ao renovar URL de imagem:', error);
                toast({
                    variant: 'destructive',
                    title: 'Erro ao atualizar link',
                    description:
                        error instanceof Error
                            ? error.message
                            : 'Não foi possível renovar a URL assinada desta imagem.',
                });
            } finally {
                setImageEntryLoading(entry.id, false);
            }
        },
        [setImageEntryLoading, toast, updateImageEntry]
    );

    const isV2 = variant === 'v2';

    const logContent =
      !log || log.length === 0 ? (
        <div
          className={clsx(
            'p-8 text-center italic',
            isV2 ? 'font-narrative text-dnd-parchment-muted' : 'text-stone-500'
          )}
        >
          A aventura ainda não começou.
        </div>
      ) : (
        <div className={clsx('space-y-3', isV2 && 'space-y-4')}>
          <PendingRollBanner />
          <NpcRollDisplay />
          {log.map((entry) => {
            if (!entry || !entry.id) return null;
            return (
              <LogEntry
                key={entry.id}
                entry={entry}
                onPlayAudio={handlePlayEntry}
                onGenerateAudio={handleGenerateAudio}
                isGenerating={Boolean(generatingEntries[entry.id])}
                playingEntryId={playingEntryId}
                onGenerateImage={IMAGE_FEATURE_ENABLED ? handleGenerateImageEntry : undefined}
                onRefreshImage={IMAGE_FEATURE_ENABLED ? handleRefreshImageEntry : undefined}
                isImageLoading={IMAGE_FEATURE_ENABLED ? Boolean(imageLoadingEntries[entry.id]) : false}
              />
            );
          })}
          <div ref={logEndRef} />
        </div>
      );

    return <NarrativeLogVariantProvider variant={variant}>{logContent}</NarrativeLogVariantProvider>;
};

export default NewNarrativeLog;
