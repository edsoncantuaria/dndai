'use client';

import Link from 'next/link';
import { GameplayPreviewShell } from '@/features/gameplay/GameplayPreviewShell';
import { AmbientBackground, DndButton, DndCard, DndHeading, DndInput } from '@/components/primitives';

export default function UiPreviewPage() {
  return (
    <div className="flex h-full min-h-screen flex-col">
      <div className="relative flex h-[calc(100vh-48px)] min-h-0 flex-1 flex-col">
        <GameplayPreviewShell />
      </div>
      <details className="shrink-0 border-t border-dnd-gold/20 bg-dnd-obsidian p-4">
        <summary className="cursor-pointer font-ui text-sm text-dnd-gold">Primitivos do design system</summary>
        <div className="relative mt-4 grid gap-4 md:grid-cols-2">
          <AmbientBackground />
          <DndCard padding="lg">
            <DndHeading variant="hero">Crônicas</DndHeading>
            <DndHeading variant="section" className="mt-2">
              Seção épica
            </DndHeading>
            <div className="mt-4 flex flex-wrap gap-2">
              <DndButton variant="ember">Ember</DndButton>
              <DndButton variant="goldOutline">Gold</DndButton>
              <DndButton variant="ghost">Ghost</DndButton>
            </div>
            <DndInput label="Email" placeholder="aventureiro@mesa.com" className="mt-4" />
          </DndCard>
        </div>
        <Link href="/" className="mt-4 inline-block font-ui text-xs text-dnd-parchment-muted hover:text-dnd-gold">
          ← Voltar ao app
        </Link>
      </details>
    </div>
  );
}
