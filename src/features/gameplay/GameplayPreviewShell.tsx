'use client';

import { useState } from 'react';
import { ActionBar } from './components/ActionBar';
import { GameplayShell } from './GameplayShell';
import { NarrativeStage, type NarrativeEntry } from './components/NarrativeStage';
import { GameplayFreeActionSheet } from './GameplayFreeActionSheet';
import { DndCard } from '@/components/primitives';

const MOCK_NARRATIVE: NarrativeEntry[] = [
  {
    id: '1',
    text: 'A tocha crepita na escuridão. Pedras úmidas refletem um brilho âmbar enquanto o corredor se curva para o desconhecido.',
    kind: 'narration',
  },
  {
    id: '2',
    text: 'Vocês ouvem passos — ou é o vento sussurrando mentiras?',
    kind: 'narration',
  },
  { id: '3', text: 'Pare e escolha com cuidado. O destino observa.', kind: 'system' },
];

const MOCK_ACTIONS = [
  'Investigar as marcas nas paredes',
  'Avançar em silêncio',
  'Preparar uma magia de luz',
  'Chamar pelo grupo',
];

/** Preview estático para /ui-preview */
export function GameplayPreviewShell() {
  const [freeOpen, setFreeOpen] = useState(false);
  const [freeText, setFreeText] = useState('');

  return (
    <>
      <GameplayShell
        region="Ruínas de Kael — Nível 3"
        timeLabel="Crepúsculo"
        weatherLabel="Nublado"
        narrative={<NarrativeStage entries={MOCK_NARRATIVE} className="flex-1" />}
        actionDock={
          <ActionBar
            options={MOCK_ACTIONS}
            statusLabel="Preview UI v2"
            onFreeAction={() => setFreeOpen(true)}
            onSelect={(i, t) => console.log('[preview]', i, t)}
          />
        }
        sidePanel={(tab) => (
          <DndCard padding="md">
            <p className="font-ui text-sm text-dnd-parchment-muted">
              Painel <span className="capitalize text-dnd-gold">{tab}</span> (mock)
            </p>
          </DndCard>
        )}
      />
      <GameplayFreeActionSheet
        open={freeOpen}
        onOpenChange={setFreeOpen}
        value={freeText}
        onChange={setFreeText}
        onSubmit={() => {
          console.log('[preview] free', freeText);
          setFreeOpen(false);
          setFreeText('');
        }}
      />
    </>
  );
}
