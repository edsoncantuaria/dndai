'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Character, SessaoIA } from '@/types';
import { findSessionForCharacter } from '@/utils/sessionMatching';
import { DndButton, DndInput } from '@/components/primitives';
import { HubLayout, HubStatPill } from '../HubLayout';
import { HeroCard } from './HeroCard';

export interface HeroVaultProps {
  characters: Character[];
  sessions: SessaoIA[];
  onBack: () => void;
  onCreateHero: () => void;
  onStartWithHero: (character: Character, existingSession?: SessaoIA | null) => void;
  onDeleteHero: (character: Character) => void;
  onViewSessions: () => void;
}

export function HeroVault({
  characters,
  sessions,
  onBack,
  onCreateHero,
  onStartWithHero,
  onDeleteHero,
  onViewSessions,
}: HeroVaultProps) {
  const [classFilter, setClassFilter] = useState('');
  const [raceFilter, setRaceFilter] = useState('');
  const [levelMin, setLevelMin] = useState('');

  const classes = useMemo(
    () => [...new Set(characters.map((c) => c.characterClass).filter(Boolean))].sort(),
    [characters]
  );
  const races = useMemo(
    () => [...new Set(characters.map((c) => c.race).filter(Boolean))].sort(),
    [characters]
  );

  const filtered = useMemo(() => {
    const min = levelMin ? parseInt(levelMin, 10) : 0;
    return characters.filter((c) => {
      if (classFilter && c.characterClass !== classFilter) return false;
      if (raceFilter && c.race !== raceFilter) return false;
      if (min && c.level < min) return false;
      return true;
    });
  }, [characters, classFilter, raceFilter, levelMin]);

  return (
    <HubLayout
      title="Cofre de heróis"
      subtitle="Escolha o protagonista da próxima saga ou forje um novo campeão."
      label="Arsenal"
      onBack={onBack}
      headerActions={
        <DndButton variant="ember" onClick={onCreateHero}>
          <Plus className="h-4 w-4" />
          Criar novo
        </DndButton>
      }
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <HubStatPill label="Heróis" value={characters.length} />
        <HubStatPill label="Filtrados" value={filtered.length} />
        <HubStatPill label="Sessões" value={sessions.length} />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block font-ui text-xs text-dnd-parchment-muted">Classe</label>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="w-full min-h-[44px] rounded-md border border-dnd-gold/25 bg-dnd-obsidian-raised px-3 font-ui text-sm text-dnd-parchment"
          >
            <option value="">Todas</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block font-ui text-xs text-dnd-parchment-muted">Raça</label>
          <select
            value={raceFilter}
            onChange={(e) => setRaceFilter(e.target.value)}
            className="w-full min-h-[44px] rounded-md border border-dnd-gold/25 bg-dnd-obsidian-raised px-3 font-ui text-sm text-dnd-parchment"
          >
            <option value="">Todas</option>
            {races.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <DndInput
          label="Nível mínimo"
          type="number"
          min={1}
          max={20}
          value={levelMin}
          onChange={(e) => setLevelMin(e.target.value)}
          placeholder="Qualquer"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-dnd-gold/25 py-12 text-center">
          <p className="font-narrative text-dnd-parchment-muted">
            {characters.length === 0
              ? 'O cofre está vazio. Crie seu primeiro herói.'
              : 'Nenhum herói corresponde aos filtros.'}
          </p>
          {characters.length === 0 ? (
            <DndButton variant="ember" className="mt-4" onClick={onCreateHero}>
              <Plus className="h-4 w-4" />
              Criar herói
            </DndButton>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((char) => (
            <HeroCard
              key={char.id}
              character={char}
              onPlay={() => onStartWithHero(char, findSessionForCharacter(char, sessions))}
              onDelete={() => onDeleteHero(char)}
              onViewSessions={onViewSessions}
            />
          ))}
        </div>
      )}
    </HubLayout>
  );
}
