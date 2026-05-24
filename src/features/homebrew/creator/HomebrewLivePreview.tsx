'use client';

import { DndBadge, DndCard, DndHeading } from '@/components/primitives';
import { SourceKindBadge } from '@/features/homebrew/sourceKindBadge';
import type * as HomebrewService from '@/services/homebrewService';
import type { HomebrewCreatorStepId } from './constants';
import { HOMEBREW_CREATOR_STEPS } from './constants';

export interface HomebrewLivePreviewProps {
  activeStep: HomebrewCreatorStepId;
  type: HomebrewService.HomebrewContentType;
  sourceKind: HomebrewService.HomebrewSourceKind;
  contentData: Record<string, unknown>;
  isPublic: boolean;
  locale: string;
}

function pickPreviewLines(data: Record<string, unknown>, type: string): string[] {
  const lines: string[] = [];
  if (typeof data.desc === 'string' && data.desc) {
    lines.push(data.desc.slice(0, 120) + (data.desc.length > 120 ? '…' : ''));
  }
  if (type === 'spell' && data.level !== undefined) lines.push(`Nível: ${String(data.level)}`);
  if (type === 'item' && data.equipment_category) {
    const cat = data.equipment_category as { name?: string };
    if (cat?.name) lines.push(`Categoria: ${cat.name}`);
  }
  if (type === 'monster' && data.challenge_rating !== undefined) {
    lines.push(`ND: ${String(data.challenge_rating)}`);
  }
  if (typeof data.size === 'string') lines.push(`Tamanho: ${data.size}`);
  return lines.slice(0, 4);
}

export function HomebrewLivePreview({
  activeStep,
  type,
  sourceKind,
  contentData,
  isPublic,
  locale,
}: HomebrewLivePreviewProps) {
  const stepMeta = HOMEBREW_CREATOR_STEPS.find((s) => s.id === activeStep);
  const name = typeof contentData.name === 'string' ? contentData.name : 'Sem nome';
  const index = typeof contentData.index === 'string' ? contentData.index : '—';
  const previewLines = pickPreviewLines(contentData, type);
  const fieldCount = Object.keys(contentData || {}).length;

  return (
    <DndCard
      padding="md"
      className="lg:sticky lg:top-4 border-dnd-gold/20 bg-[linear-gradient(165deg,rgba(251,191,36,0.06),transparent_45%)]"
    >
      <DndHeading variant="label">Pré-visualização</DndHeading>
      <p className="mt-0.5 font-ui text-xs text-dnd-parchment-muted">{stepMeta?.label ?? activeStep}</p>

      <div className="mt-4 space-y-3">
        <div>
          <h3 className="font-display text-lg text-dnd-parchment">{name}</h3>
          <p className="font-ui text-xs capitalize text-dnd-parchment-muted">{type}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <SourceKindBadge sourceKind={sourceKind} />
          <DndBadge variant={isPublic ? 'success' : 'muted'}>{isPublic ? 'Público' : 'Privado'}</DndBadge>
          <DndBadge variant="muted">{locale}</DndBadge>
        </div>

        <dl className="space-y-1 font-ui text-xs text-dnd-parchment-muted">
          <div className="flex justify-between gap-2">
            <dt>Index</dt>
            <dd className="text-dnd-parchment">{index}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Campos</dt>
            <dd className="text-dnd-parchment">{fieldCount}</dd>
          </div>
        </dl>

        {previewLines.length > 0 ? (
          <div className="rounded-md border border-dnd-gold/15 bg-dnd-obsidian-raised/60 p-3">
            <p className="font-narrative text-sm leading-relaxed text-dnd-parchment-muted">{previewLines.join(' · ')}</p>
          </div>
        ) : (
          <p className="font-narrative text-sm italic text-dnd-parchment-muted">
            Preencha a estrutura para ver detalhes aqui.
          </p>
        )}
      </div>
    </DndCard>
  );
}
