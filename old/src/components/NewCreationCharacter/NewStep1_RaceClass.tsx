// src/components/NewCreationCharacter/NewStep1_RaceClass.tsx
import React, { useState, useMemo } from 'react';
import type { ApiListItem, ApiTrait } from '@/types';
import { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import { Dice5, Loader2, Eye } from 'lucide-react';
import * as DndApiService from '@/services/dndApiService';
import ClassDetailsModal from './ClassDetailsModal';
import {
  WizardDetailPanel,
  WizardPickCard,
  WizardPickGrid,
  WizardSection,
} from '@/features/character-create/wizardUi';
import { DndButton } from '@/components/primitives';

const TraitDisplay: React.FC<{ trait: ApiListItem }> = ({ trait }) => {
  const [details, setDetails] = useState<ApiTrait | null>(null);

  const fetchDetails = async () => {
    if (!details) {
      const data = await DndApiService.getTraitDetails(trait.index);
      setDetails(data);
    }
  };

  return (
    <div className="group relative text-sm">
      <button
        type="button"
        onMouseEnter={fetchDetails}
        onFocus={fetchDetails}
        className="font-ui font-semibold text-dnd-parchment underline decoration-dotted decoration-dnd-gold/40"
      >
        {trait.name}
      </button>
      {details ? (
        <div className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-72 rounded-lg border border-dnd-gold/20 bg-dnd-obsidian p-3 text-xs text-dnd-parchment opacity-0 shadow-[var(--dnd-shadow-elevated)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <h4 className="mb-1 font-display text-dnd-gold">{details.name}</h4>
          <div className="space-y-1 font-narrative text-dnd-parchment-muted">
            {details.desc.map((d, i) => (
              <p key={i}>{d}</p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const RaceDetailsDisplay: React.FC<Pick<Props, 'hook'>> = ({ hook }) => {
  const {
    details: { raceDetails, subraceDetails },
    racialBonuses,
  } = hook;

  if (!raceDetails) return null;

  const finalTraits = Array.from(
    new Map([...(raceDetails?.traits || []), ...(subraceDetails?.racial_traits || [])].map((item) => [item.index, item])).values(),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg text-dnd-parchment">
            {raceDetails.name} {subraceDetails ? `(${subraceDetails.name})` : ''}
          </p>
        </div>
        <span className="rounded-full border border-dnd-gold/30 bg-dnd-gold/10 px-2.5 py-0.5 font-ui text-xs text-dnd-gold">
          {raceDetails.size || 'Médio'}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-dnd-gold/10 bg-dnd-obsidian/60 p-3">
          <p className="font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">Bônus</p>
          <p className="mt-1 font-ui text-sm text-dnd-parchment">
            {Object.entries(racialBonuses)
              .map(([attr, bonus]) => `${attr.substring(0, 3).toUpperCase()} +${bonus}`)
              .join(', ') || 'Nenhum bônus fixo'}
          </p>
        </div>
        <div className="rounded-lg border border-dnd-gold/10 bg-dnd-obsidian/60 p-3">
          <p className="font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">Deslocamento</p>
          <p className="mt-1 font-ui text-sm text-dnd-parchment">{raceDetails.speed} pés</p>
        </div>
      </div>

      {finalTraits.length > 0 ? (
        <div>
          <p className="mb-2 font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">Traços raciais</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {finalTraits.map((trait) => (
              <TraitDisplay key={trait.index} trait={trait} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

interface Props {
  hook: ReturnType<typeof useCharacterCreator>;
  races: ApiListItem[];
  classes: ApiListItem[];
  nextStep: () => void;
  hideNav?: boolean;
}

const NewStep1_RaceClass: React.FC<Props> = ({ hook, races, classes }) => {
  const {
    race,
    subrace,
    characterClass,
    handleRaceChange,
    handleSubraceChange,
    handleClassChange,
    details: { raceDetails, classDetails, draconicAncestryOptions },
    loadingStates,
    handleRandomizeRaceAndClass,
    isVariantHuman,
    setField,
    draconicAncestry,
  } = hook;

  const [isClassModalOpen, setIsClassModalOpen] = useState(false);

  const canProceed = useMemo(() => {
    if (!race || !characterClass) return false;
    if (race === 'dragonborn' && !draconicAncestry) return false;
    const needsSubrace = (raceDetails?.subraces?.length ?? 0) > 0;
    if (needsSubrace && !subrace) return false;
    return true;
  }, [race, characterClass, draconicAncestry, raceDetails?.subraces?.length, subrace]);

  const classSavingThrows = classDetails?.saving_throws
    ?.map((st) => st.name)
    .join(', ');
  const classHitDie = classDetails?.hit_die ? `d${classDetails.hit_die}` : '—';
  const hasClassProfile = Boolean(characterClass && classDetails?.hit_die);
  const classSubclass = classDetails?.subclasses?.[0]?.name;

  return (
    <>
      <div className="space-y-5">
        <WizardSection
          eyebrow="Legado"
          title="Escolha sua raça"
          description="Define traços, idiomas e bônus de atributo. Os detalhes aparecem assim que você selecionar."
          action={
            <DndButton
              variant="goldOutline"
              size="sm"
              type="button"
              onClick={() => handleRandomizeRaceAndClass(races, classes)}
            >
              <Dice5 className="h-4 w-4" />
              Surpreenda-me
            </DndButton>
          }
        >
          <WizardPickGrid columns={2}>
            {races.map((r) => (
              <WizardPickCard
                key={r.index}
                title={r.name}
                subtitle={race === r.index && raceDetails ? `${raceDetails.speed} pés · ${raceDetails.size || 'Médio'}` : undefined}
                selected={race === r.index}
                onClick={() => handleRaceChange(r.index)}
              />
            ))}
          </WizardPickGrid>

          {race && !raceDetails && loadingStates.isFetching ? (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-dnd-gold/15 bg-dnd-obsidian/60 px-4 py-3">
              <Loader2 className="h-5 w-5 animate-spin text-dnd-gold" />
              <p className="font-ui text-sm text-dnd-parchment-muted">
                {loadingStates.message || 'Carregando detalhes da raça…'}
              </p>
            </div>
          ) : null}

          <div className="mt-4">
            <WizardDetailPanel
              title="Detalhes da raça"
              isEmpty={!race || !raceDetails}
              empty="Selecione uma raça acima para ver bônus, velocidade e traços."
            >
              <RaceDetailsDisplay hook={hook} />
            </WizardDetailPanel>
          </div>

          {(raceDetails?.subraces?.length ?? 0) > 0 ? (
            <div className="mt-5 space-y-3 border-t border-dnd-gold/10 pt-5">
              <p className="font-display text-base text-dnd-parchment">Sub-raça</p>
              <WizardPickGrid columns={2}>
                {(raceDetails?.subraces ?? []).map((sr: ApiListItem) => (
                  <WizardPickCard
                    key={sr.index}
                    title={sr.name}
                    selected={subrace === sr.index}
                    onClick={() => handleSubraceChange(sr.index)}
                  />
                ))}
              </WizardPickGrid>
            </div>
          ) : null}

          {race === 'human' ? (
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-dnd-success/25 bg-dnd-success/5 p-4">
              <input
                type="checkbox"
                checked={isVariantHuman}
                onChange={(e) => setField('isVariantHuman', e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-dnd-success/50 text-dnd-success focus:ring-dnd-success/40"
              />
              <span>
                <span className="block font-display text-sm text-dnd-parchment">Humano variante</span>
                <span className="mt-0.5 block font-ui text-xs leading-relaxed text-dnd-parchment-muted">
                  +1 em dois atributos, uma perícia extra e um talento inicial.
                </span>
              </span>
            </label>
          ) : null}

          {race === 'dragonborn' && draconicAncestryOptions ? (
            <div className="mt-4 space-y-2 rounded-lg border border-dnd-ember/25 bg-dnd-ember/5 p-4">
              <p className="font-display text-sm text-dnd-parchment">Ancestralidade dracônica</p>
              <select
                value={hook.draconicAncestry}
                onChange={(e) => setField('draconicAncestry', e.target.value)}
                className="w-full rounded-lg border border-dnd-gold/20 bg-dnd-obsidian px-3 py-2.5 font-ui text-sm text-dnd-parchment focus:border-dnd-gold focus:outline-none"
              >
                <option value="" disabled>
                  Escolha sua linhagem…
                </option>
                {draconicAncestryOptions.map((opt) => {
                  const dragonName = opt.name.replace('Draconic Ancestry: ', '');
                  const damageType = opt.damage_type || 'Desconhecido';
                  return (
                    <option key={opt.index} value={opt.index}>
                      {dragonName} (sopro de {damageType})
                    </option>
                  );
                })}
              </select>
            </div>
          ) : null}
        </WizardSection>

        <WizardSection
          eyebrow="Vocação"
          title="Escolha sua classe"
          description="Define proficiências, dado de vida e estilo de combate."
        >
          <WizardPickGrid columns={2}>
            {classes.map((c) => (
              <WizardPickCard
                key={c.index}
                title={c.name}
                subtitle={
                  characterClass === c.index && classDetails
                    ? `DV ${classHitDie}${classSavingThrows ? ` · ${classSavingThrows}` : ''}`
                    : undefined
                }
                selected={characterClass === c.index}
                onClick={() => handleClassChange(c.index)}
              />
            ))}
          </WizardPickGrid>

          <div className="mt-4">
            <WizardDetailPanel
              title="Perfil da classe"
              isEmpty={!hasClassProfile}
              empty={
                !characterClass
                  ? 'Selecione uma classe para ver dado de vida, resistências e subclasse.'
                  : loadingStates.isFetching
                    ? 'Carregando perfil da classe…'
                    : 'Não foi possível carregar o perfil — tente selecionar a classe novamente.'
              }
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display text-lg text-dnd-parchment">{classDetails?.name}</p>
                  <button
                    type="button"
                    onClick={() => setIsClassModalOpen(true)}
                    className="rounded-md p-1.5 text-dnd-parchment-muted transition hover:bg-dnd-mist hover:text-dnd-gold"
                    aria-label="Ver classe completa"
                  >
                    <Eye className="h-5 w-5" />
                  </button>
                </div>
                <div className="grid gap-2 font-ui text-sm sm:grid-cols-3">
                  <div className="rounded-md border border-dnd-gold/10 px-3 py-2">
                    <p className="text-[10px] uppercase text-dnd-parchment-muted">Dado de vida</p>
                    <p className="text-dnd-parchment">{classHitDie}</p>
                  </div>
                  <div className="rounded-md border border-dnd-gold/10 px-3 py-2 sm:col-span-2">
                    <p className="text-[10px] uppercase text-dnd-parchment-muted">Resistências</p>
                    <p className="text-dnd-parchment">{classSavingThrows || '—'}</p>
                  </div>
                  <div className="rounded-md border border-dnd-gold/10 px-3 py-2 sm:col-span-3">
                    <p className="text-[10px] uppercase text-dnd-parchment-muted">Subclasse típica</p>
                    <p className="text-dnd-parchment">{classSubclass || 'Escolhida no nível 3'}</p>
                  </div>
                </div>
              </div>
            </WizardDetailPanel>
          </div>
        </WizardSection>

        {!canProceed ? (
          <p className="rounded-lg border border-dnd-gold/15 bg-dnd-obsidian/60 px-4 py-3 font-ui text-sm text-dnd-parchment-muted">
            Selecione raça{raceDetails?.subraces?.length ? ', sub-raça' : ''}
            {race === 'dragonborn' ? ' e ancestralidade dracônica' : ''} e classe para continuar.
          </p>
        ) : null}
      </div>

      {classDetails ? (
        <ClassDetailsModal
          isOpen={isClassModalOpen}
          onClose={() => setIsClassModalOpen(false)}
          classDetails={classDetails}
          classLevels={hook.details.classLevels || []}
        />
      ) : null}
    </>
  );
};

export default NewStep1_RaceClass;
