'use client';

import { useState } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import { AmbientBackground, DndButton, DndCard, DndHeading } from '@/components/primitives';
import type { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import { CHARACTER_ARCHETYPES, applyArchetype, type ArchetypeDef } from './archetypes';

export function ArchetypePicker({
  hook,
  onStartBlank,
  onApplied,
}: {
  hook: ReturnType<typeof useCharacterCreator>;
  onStartBlank: () => void;
  onApplied: () => void;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const pick = async (archetype: ArchetypeDef) => {
    setLoadingId(archetype.id);
    try {
      await applyArchetype(archetype, hook);
      onApplied();
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-dnd-obsidian">
      <AmbientBackground variant="cinematic" />
      <div className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-2xl flex-col overflow-y-auto px-4 py-6 sm:px-6">
        <DndHeading variant="label" className="text-dnd-ember">
          Forja de herói
        </DndHeading>
        <DndHeading variant="hero" className="mt-2 text-2xl sm:text-3xl">
          Como você quer começar?
        </DndHeading>
        <p className="mt-3 font-narrative text-base leading-relaxed text-dnd-parchment-muted">
          Escolha um <strong className="text-dnd-parchment">arquetipo</strong> para preencher a ficha automaticamente
          — ou abra a ficha vazia e decida bloco a bloco.
        </p>

        <div className="mt-6 space-y-3">
          {CHARACTER_ARCHETYPES.map((arch) => {
            const Icon = arch.icon;
            const loading = loadingId === arch.id;
            return (
              <DndCard
                key={arch.id}
                padding="md"
                className="cursor-pointer transition hover:border-dnd-gold/40"
                onClick={() => !loadingId && pick(arch)}
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-dnd-gold/25 bg-dnd-gold/10 text-dnd-gold">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg text-dnd-parchment">{arch.name}</p>
                    <p className="mt-0.5 font-ui text-sm text-dnd-parchment-muted">{arch.tagline}</p>
                  </div>
                  {loading ? (
                    <span className="font-ui text-xs text-dnd-gold">Preenchendo…</span>
                  ) : (
                    <ChevronRight className="h-5 w-5 shrink-0 text-dnd-gold/60" />
                  )}
                </div>
              </DndCard>
            );
          })}
        </div>

        <DndButton variant="goldOutline" size="lg" className="mt-8 w-full" onClick={onStartBlank}>
          <Sparkles className="h-4 w-4" />
          Criar do zero — ficha vazia
        </DndButton>
      </div>
    </div>
  );
}
