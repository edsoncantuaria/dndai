'use client';

import { useCallback, useEffect, useState } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import {
  fetchSessionCast,
  syncSessionCast,
  updateCastMember,
  type CastRole,
  type CastVitals,
  type SessionCastMemberDto,
  type WorldEchoDto,
} from '@/services/sessionCastService';
import { DndCard, DndHeading } from '@/components/primitives';

const ROLE_LABEL: Record<CastRole, string> = {
  pc: 'Herói',
  npc: 'NPC',
  ally: 'Aliado',
  enemy: 'Inimigo',
};

const VITAL_OPTIONS: { value: CastVitals; label: string }[] = [
  { value: 'alive', label: 'Vivo' },
  { value: 'unconscious', label: 'Inconsciente' },
  { value: 'dead', label: 'Morto' },
];

type Props = { sessionId: number };

export function SessionCastPanel({ sessionId }: Props) {
  const { combatState, character } = useGameStateContext();
  const [cast, setCast] = useState<SessionCastMemberDto[]>([]);
  const [worldEchoes, setWorldEchoes] = useState<WorldEchoDto[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const data = combatState?.isActive
        ? await syncSessionCast(sessionId, combatState)
        : await fetchSessionCast(sessionId);
      setCast(data.cast);
      setWorldEchoes(data.worldEchoes);
    } catch {
      setCast([]);
      setWorldEchoes([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId, combatState]);

  useEffect(() => {
    void reload();
  }, [
    reload,
    character?.id,
    character?.relationships?.length,
    combatState?.isActive,
    combatState?.combatants?.length,
  ]);

  const handleVitals = async (memberId: number, vitals: CastVitals) => {
    try {
      await updateCastMember(sessionId, memberId, { vitals });
      await reload();
    } catch {
      /* ignore */
    }
  };

  const heroes = cast.filter((m) => m.role === 'pc');
  const allies = cast.filter((m) => m.role === 'ally' || m.role === 'npc');
  const enemies = cast.filter((m) => m.role === 'enemy');

  const renderGroup = (title: string, members: SessionCastMemberDto[]) => {
    if (!members.length) return null;
    return (
      <div>
        <p className="mb-2 font-ui text-[10px] font-semibold uppercase tracking-wider text-dnd-gold">
          {title}
        </p>
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.id} className="rounded-lg border border-white/10 px-2 py-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-ui text-sm text-dnd-parchment">
                  {m.displayName}{' '}
                  <span className="text-dnd-parchment-muted">({ROLE_LABEL[m.role]})</span>
                </span>
                {m.metadata && typeof m.metadata.source === 'string' ? (
                  <span className="font-ui text-[10px] text-dnd-parchment-muted/80">
                    {m.metadata.source === 'relationship' ? 'IA' : m.metadata.source === 'combat' ? 'combate' : ''}
                  </span>
                ) : null}
              </div>
              {m.role !== 'pc' ? (
                <div className="flex flex-wrap gap-1">
                  {VITAL_OPTIONS.map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      disabled={loading}
                      onClick={() => handleVitals(m.id, v.value)}
                      className={
                        m.vitals === v.value
                          ? 'rounded px-2 py-0.5 text-[10px] bg-dnd-gold/30 text-dnd-gold'
                          : 'rounded px-2 py-0.5 text-[10px] bg-white/5 text-dnd-parchment-muted hover:bg-white/10'
                      }
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const isEmpty = !cast.length && !worldEchoes.length;

  return (
    <DndCard padding="md" className="space-y-3">
      <DndHeading variant="section">Mundo vivo</DndHeading>
      <p className="font-ui text-xs text-dnd-parchment-muted">
        Personagens surgem automaticamente quando a IA os cria, quando entram em combate ou quando
        outras mesas passam pela mesma região. O cofre de heróis é só seu — o mapa compartilha
        ecos, não fichas.
      </p>

      {loading && isEmpty ? (
        <p className="font-ui text-xs text-dnd-parchment-muted">Atualizando presenças…</p>
      ) : null}

      {isEmpty && !loading ? (
        <p className="font-ui text-xs italic text-dnd-parchment-muted">
          Ainda ninguém registrado nesta crônica — converse, explore ou entre em combate para o
          elenco aparecer.
        </p>
      ) : (
        <div className="max-h-56 space-y-4 overflow-y-auto pr-1">
          {renderGroup('Seu grupo', heroes)}
          {renderGroup('Elenco', allies)}
          {renderGroup('Ameaças', enemies)}
          {worldEchoes.length > 0 ? (
            <div>
              <p className="mb-2 font-ui text-[10px] font-semibold uppercase tracking-wider text-dnd-cyan/90">
                Ecos do mundo (outras mesas)
              </p>
              <ul className="space-y-2 font-ui text-xs text-dnd-parchment-muted">
                {worldEchoes.map((echo) => (
                  <li key={`${echo.name}-${echo.regionSlug}`} className="rounded-lg border border-cyan-500/15 bg-cyan-950/20 px-2 py-2">
                    <span className="text-dnd-parchment">{echo.name}</span>
                    <p className="mt-1 leading-relaxed">{echo.note}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </DndCard>
  );
}
