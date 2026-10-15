'use client';

import { Lock, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import {
  countCompleteBlocks,
  getBlockSummary,
  getVisibleBlocks,
  isBlockComplete,
  isBlockLocked,
  type SheetBlockDef,
} from './sheetBlocks';

const ATTR_LABELS: { key: keyof ReturnType<typeof useCharacterCreator>['baseAttributes']; label: string }[] = [
  { key: 'strength', label: 'FOR' },
  { key: 'dexterity', label: 'DES' },
  { key: 'constitution', label: 'CON' },
  { key: 'intelligence', label: 'INT' },
  { key: 'wisdom', label: 'SAB' },
  { key: 'charisma', label: 'CAR' },
];

function SheetBlockCard({
  block,
  hook,
  onOpen,
}: {
  block: SheetBlockDef;
  hook: ReturnType<typeof useCharacterCreator>;
  onOpen: () => void;
}) {
  const Icon = block.icon;
  const locked = isBlockLocked(block.step, hook);
  const complete = isBlockComplete(block.step, hook);
  const summary = getBlockSummary(block, hook);

  return (
    <button
      type="button"
      disabled={locked}
      onClick={onOpen}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all sm:p-4',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dnd-gold/50',
        locked && 'cursor-not-allowed opacity-45',
        complete
          ? 'border-dnd-success/35 bg-dnd-success/5'
          : locked
            ? 'border-dnd-mist-strong bg-dnd-obsidian/40'
            : 'border-dnd-ember/40 bg-dnd-ember/5 shadow-[0_0_24px_-8px_rgba(196,30,58,0.35)]',
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
          complete
            ? 'border-dnd-success/40 bg-dnd-success/10 text-dnd-success'
            : locked
              ? 'border-dnd-mist-strong text-dnd-parchment-muted'
              : 'border-dnd-ember/40 bg-dnd-ember/10 text-dnd-ember',
        )}
      >
        {locked ? <Lock className="h-4 w-4" /> : complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-display text-base text-dnd-parchment">{block.title}</span>
          {complete ? (
            <span className="rounded-full bg-dnd-success/15 px-2 py-0.5 font-ui text-[10px] font-semibold uppercase text-dnd-success">
              Ok
            </span>
          ) : !locked ? (
            <span className="rounded-full bg-dnd-ember/15 px-2 py-0.5 font-ui text-[10px] font-semibold uppercase text-dnd-ember">
              Pendente
            </span>
          ) : null}
        </span>
        <span className="mt-1 block font-ui text-xs leading-snug text-dnd-parchment-muted">{summary}</span>
      </span>
      {!locked ? <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-dnd-gold/70" /> : null}
    </button>
  );
}

export function LivingCharacterSheet({
  hook,
  onOpenBlock,
}: {
  hook: ReturnType<typeof useCharacterCreator>;
  onOpenBlock: (block: SheetBlockDef) => void;
}) {
  const blocks = getVisibleBlocks(hook);
  const { done, total } = countCompleteBlocks(hook);
  const attributesReady = isBlockComplete(2, hook);
  const attrs = attributesReady ? hook.finalAttributes || hook.baseAttributes : null;
  const mods = attributesReady ? hook.modifiers : null;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const identityLine = [
    hook.details.raceDetails?.name,
    hook.details.classDetails?.name,
    hook.details.backgroundDetails?.name,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Ficha — cartão principal */}
      <div className="overflow-hidden rounded-2xl border-2 border-dnd-gold/25 bg-gradient-to-b from-dnd-parchment/[0.04] to-dnd-obsidian-raised/95 shadow-[var(--dnd-shadow-elevated)]">
        {/* Cabeçalho da ficha */}
        <div className="border-b border-dnd-gold/20 bg-dnd-obsidian/80 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.3em] text-dnd-gold">
                Personagem · Nível 1
              </p>
              <h1 className="mt-1 font-display text-2xl text-dnd-parchment sm:text-3xl">
                {hook.name || 'Herói sem nome'}
              </h1>
              <p className="mt-1 font-ui text-sm text-dnd-parchment-muted">
                {identityLine || 'Preencha identidade, história e revelação'}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl text-dnd-gold">{progress}%</p>
              <p className="font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">
                {done}/{total} blocos
              </p>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-dnd-mist-strong">
            <div
              className="h-full rounded-full bg-gradient-to-r from-dnd-ember to-dnd-gold transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Atributos — sempre visíveis */}
        <div className="grid grid-cols-3 gap-px border-b border-dnd-gold/15 bg-dnd-gold/10 sm:grid-cols-6">
          {ATTR_LABELS.map(({ key, label }) => {
            const score = attributesReady ? attrs?.[key] : undefined;
            const mod = attributesReady ? mods?.[key] : undefined;
            return (
              <div
                key={key}
                className="flex flex-col items-center bg-dnd-obsidian/90 px-2 py-3 text-center"
              >
                <span className="font-ui text-[10px] font-bold text-dnd-gold">{label}</span>
                <span className="font-display text-xl leading-none text-dnd-parchment">
                  {score ?? '—'}
                </span>
                <span className="mt-0.5 font-ui text-[10px] text-dnd-parchment-muted">
                  {typeof mod === 'number' ? (mod >= 0 ? `+${mod}` : mod) : '—'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Combate rápido */}
        <div className="grid grid-cols-3 divide-x divide-dnd-gold/10 border-b border-dnd-gold/15 bg-dnd-obsidian/60">
          <div className="px-3 py-2.5 text-center">
            <p className="font-ui text-[9px] uppercase text-dnd-parchment-muted">CA</p>
            <p className="font-display text-lg text-dnd-gold">{hook.ac?.value ?? '—'}</p>
          </div>
          <div className="px-3 py-2.5 text-center">
            <p className="font-ui text-[9px] uppercase text-dnd-parchment-muted">PV</p>
            <p className="font-display text-lg text-dnd-gold">{hook.hp?.max ?? '—'}</p>
          </div>
          <div className="px-3 py-2.5 text-center">
            <p className="font-ui text-[9px] uppercase text-dnd-parchment-muted">Prof.</p>
            <p className="font-display text-lg text-dnd-gold">+{hook.proficiencyBonus ?? 2}</p>
          </div>
        </div>

        {/* Blocos editáveis */}
        <div className="space-y-2 p-4 sm:p-5">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.24em] text-dnd-parchment-muted">
            Toque em um bloco para editar
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {blocks.map((block) => (
              <SheetBlockCard
                key={block.id}
                block={block}
                hook={hook}
                onOpen={() => !isBlockLocked(block.step, hook) && onOpenBlock(block)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
