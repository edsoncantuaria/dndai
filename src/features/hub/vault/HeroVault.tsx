'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, SlidersHorizontal, Sparkles, Users, X } from 'lucide-react';
import type { Character, SessaoIA } from '@/types';
import { findSessionForCharacter } from '@/utils/sessionMatching';
import { DndButton } from '@/components/primitives';
import { cn } from '@/lib/utils';
import { HubLayout } from '../HubLayout';
import { HeroCard } from './HeroCard';
import {
  countVaultFilters,
  emptyVaultFilters,
  HeroVaultFilterSheet,
  type VaultFilters,
} from './HeroVaultFilterSheet';

const searchInputClassName =
  'w-full min-h-[48px] rounded-xl border border-dnd-gold/20 bg-dnd-obsidian-raised pl-11 pr-4 font-ui text-base text-dnd-parchment placeholder:text-dnd-parchment-muted/70 shadow-sm transition focus:border-dnd-gold/45 focus:outline-none focus:ring-2 focus:ring-dnd-gold/20';

export interface HeroVaultProps {
  characters: Character[];
  sessions: SessaoIA[];
  onBack: () => void;
  onCreateHero: () => void;
  onEditHero: (character: Character) => void;
  onStartWithHero: (character: Character, existingSession?: SessaoIA | null) => void;
  onDeleteHero: (character: Character) => void;
  onViewSessions: () => void;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-dnd-gold/25 bg-dnd-obsidian-raised/80 py-1 pl-3 pr-1 font-ui text-xs text-dnd-parchment">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-1 text-dnd-parchment-muted transition hover:bg-dnd-gold/15 hover:text-dnd-gold"
        aria-label={`Remover filtro ${label}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

export function HeroVault({
  characters,
  sessions,
  onBack,
  onCreateHero,
  onEditHero,
  onStartWithHero,
  onDeleteHero,
  onViewSessions,
}: HeroVaultProps) {
  const [nameQuery, setNameQuery] = useState('');
  const [vaultFilters, setVaultFilters] = useState<VaultFilters>(emptyVaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { classFilter, raceFilter, levelMin } = vaultFilters;

  const classes = useMemo(
    () => [...new Set(characters.map((c) => c.characterClass).filter(Boolean))].sort(),
    [characters]
  );
  const races = useMemo(
    () => [...new Set(characters.map((c) => c.race).filter(Boolean))].sort(),
    [characters]
  );

  const filterCount = countVaultFilters(vaultFilters);
  const hasSearch = Boolean(nameQuery.trim());
  const hasAnyFilter = filterCount > 0 || hasSearch;

  const filtered = useMemo(() => {
    const min = levelMin ? parseInt(levelMin, 10) : 0;
    const q = nameQuery.trim().toLowerCase();
    return characters.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (classFilter && c.characterClass !== classFilter) return false;
      if (raceFilter && c.race !== raceFilter) return false;
      if (min && c.level < min) return false;
      return true;
    });
  }, [characters, classFilter, raceFilter, levelMin, nameQuery]);

  const clearAll = () => {
    setNameQuery('');
    setVaultFilters(emptyVaultFilters);
  };

  const resultLabel =
    characters.length === 0
      ? 'Nenhum herói no cofre'
      : filtered.length === characters.length
        ? `${characters.length} ${characters.length === 1 ? 'herói' : 'heróis'}`
        : `${filtered.length} de ${characters.length} heróis`;

  return (
    <HubLayout
      title="Cofre de heróis"
      subtitle="Escolha quem lidera a próxima saga ou forje um novo campeão."
      label="Personagens"
      onBack={onBack}
      headerActions={
        <DndButton variant="ember" onClick={onCreateHero}>
          <Plus className="h-4 w-4" />
          Novo herói
        </DndButton>
      }
    >
      <div className="mb-5 flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-dnd-gold/70"
              aria-hidden
            />
            <input
              type="search"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Buscar por nome…"
              className={searchInputClassName}
              aria-label="Buscar herói por nome"
            />
          </div>
          <DndButton
            type="button"
            variant="goldOutline"
            className={cn('relative shrink-0 gap-1.5 px-4', filterCount > 0 && 'border-dnd-gold/50')}
            onClick={() => setFiltersOpen(true)}
            aria-label={filterCount > 0 ? `Filtros (${filterCount} ativos)` : 'Abrir filtros'}
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0" />
            Filtros
            {filterCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-dnd-ember px-1 font-ui text-[10px] font-bold text-white">
                {filterCount}
              </span>
            ) : null}
          </DndButton>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-ui text-sm text-dnd-parchment">{resultLabel}</p>
          {sessions.length > 0 ? (
            <p className="font-ui text-xs text-dnd-parchment-muted">
              {sessions.length} {sessions.length === 1 ? 'sessão' : 'sessões'} ligadas
            </p>
          ) : null}
        </div>

        {hasAnyFilter ? (
          <div className="flex flex-wrap items-center gap-2">
            {classFilter ? (
              <FilterChip
                label={`Classe: ${classFilter}`}
                onRemove={() => setVaultFilters((f) => ({ ...f, classFilter: '' }))}
              />
            ) : null}
            {raceFilter ? (
              <FilterChip
                label={`Raça: ${raceFilter}`}
                onRemove={() => setVaultFilters((f) => ({ ...f, raceFilter: '' }))}
              />
            ) : null}
            {levelMin ? (
              <FilterChip
                label={`Nv. ${levelMin}+`}
                onRemove={() => setVaultFilters((f) => ({ ...f, levelMin: '' }))}
              />
            ) : null}
            {hasSearch ? (
              <FilterChip label={`“${nameQuery.trim()}”`} onRemove={() => setNameQuery('')} />
            ) : null}
            <button
              type="button"
              onClick={clearAll}
              className="font-ui text-xs text-dnd-gold underline-offset-2 hover:underline"
            >
              Limpar tudo
            </button>
          </div>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dnd-gold/15 bg-dnd-obsidian-raised/50 px-6 py-16 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-dnd-gold/15 text-dnd-gold ring-1 ring-dnd-gold/25">
            {characters.length === 0 ? (
              <Sparkles className="h-8 w-8" aria-hidden />
            ) : (
              <Users className="h-8 w-8" aria-hidden />
            )}
          </div>
          <h2 className="font-display text-2xl text-dnd-parchment">
            {characters.length === 0 ? 'Cofre vazio' : 'Nada encontrado'}
          </h2>
          <p className="mt-3 max-w-xs font-narrative text-[0.95rem] leading-relaxed text-dnd-parchment-muted">
            {characters.length === 0
              ? 'Seu primeiro herói aparece aqui assim que a ficha for criada.'
              : 'Tente outro nome ou abra Filtros para ampliar a busca.'}
          </p>
          {characters.length === 0 ? (
            <DndButton variant="ember" className="mt-7 min-h-[48px] px-6" onClick={onCreateHero}>
              <Plus className="h-4 w-4" />
              Criar primeiro herói
            </DndButton>
          ) : (
            <div className="mt-7 flex flex-wrap justify-center gap-2">
              {hasAnyFilter ? (
                <DndButton variant="goldOutline" onClick={clearAll}>
                  Limpar busca e filtros
                </DndButton>
              ) : null}
              <DndButton variant="ember" onClick={onCreateHero}>
                <Plus className="h-4 w-4" />
                Novo herói
              </DndButton>
            </div>
          )}
        </div>
      ) : (
        <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((char) => (
            <li key={char.id} className="min-w-0">
              <HeroCard
                character={char}
                onPlay={() => onStartWithHero(char, findSessionForCharacter(char, sessions))}
                onEdit={() => onEditHero(char)}
                onDelete={() => onDeleteHero(char)}
                onViewSessions={onViewSessions}
              />
            </li>
          ))}
        </ul>
      )}

      <HeroVaultFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        applied={vaultFilters}
        onApply={setVaultFilters}
        classes={classes}
        races={races}
      />
    </HubLayout>
  );
}
