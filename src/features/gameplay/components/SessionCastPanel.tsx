'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  addCastMember,
  deleteCastMember,
  fetchSessionCast,
  updateCastMember,
  type CastRole,
  type CastVitals,
  type SessionCastMemberDto,
} from '@/services/sessionCastService';
import { getCharacters } from '@/services/gameService';
import type { Character } from '@/types';
import { DndButton, DndCard, DndHeading, DndInput } from '@/components/primitives';

const ROLE_OPTIONS: { value: CastRole; label: string }[] = [
  { value: 'npc', label: 'NPC' },
  { value: 'ally', label: 'Aliado' },
  { value: 'enemy', label: 'Inimigo' },
  { value: 'pc', label: 'PJ' },
];

const VITAL_OPTIONS: { value: CastVitals; label: string }[] = [
  { value: 'alive', label: 'Vivo' },
  { value: 'unconscious', label: 'Inconsciente' },
  { value: 'dead', label: 'Morto' },
];

type Props = { sessionId: number };

export function SessionCastPanel({ sessionId }: Props) {
  const [cast, setCast] = useState<SessionCastMemberDto[]>([]);
  const [vault, setVault] = useState<Character[]>([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState<CastRole>('npc');
  const [importId, setImportId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!sessionId) return;
    const list = await fetchSessionCast(sessionId);
    setCast(list);
  }, [sessionId]);

  useEffect(() => {
    reload().catch(() => setCast([]));
    getCharacters()
      .then(setVault)
      .catch(() => setVault([]));
  }, [reload]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await addCastMember(sessionId, { displayName: name.trim(), role });
      setName('');
      await reload();
    } finally {
      setLoading(false);
    }
  };

  const handleImportFromVault = async () => {
    const id = Number(importId);
    const hero = vault.find((c) => c.id === id);
    if (!hero) return;
    setLoading(true);
    try {
      await addCastMember(sessionId, {
        displayName: hero.name,
        role: role === 'pc' ? 'ally' : role,
        characterId: hero.id,
      });
      setImportId('');
      await reload();
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (memberId: number) => {
    setLoading(true);
    try {
      await deleteCastMember(sessionId, memberId);
      await reload();
    } finally {
      setLoading(false);
    }
  };

  const handleVitals = async (memberId: number, vitals: CastVitals) => {
    setLoading(true);
    try {
      await updateCastMember(sessionId, memberId, { vitals });
      await reload();
    } finally {
      setLoading(false);
    }
  };

  const vaultAvailable = vault.filter(
    (c) => !cast.some((m) => m.characterId === c.id),
  );

  return (
    <DndCard padding="md" className="space-y-3">
      <DndHeading variant="section">Elenco da aventura</DndHeading>
      <p className="font-ui text-xs text-dnd-parchment-muted">
        NPCs, aliados e inimigos desta crônica. Reutilize heróis do cofre — o mestre mantém nomes e
        vitalidade consistentes.
      </p>
      <ul className="max-h-48 space-y-2 overflow-y-auto font-ui text-sm">
        {cast.map((m) => (
          <li
            key={m.id}
            className="rounded-lg border border-white/10 px-2 py-2 space-y-1"
          >
            <div className="flex items-center justify-between gap-2">
              <span>
                {m.displayName}{' '}
                <span className="text-dnd-parchment-muted">({m.role})</span>
              </span>
              {m.role !== 'pc' && (
                <button
                  type="button"
                  className="text-xs text-rose-400 hover:underline"
                  disabled={loading}
                  onClick={() => handleRemove(m.id)}
                >
                  Remover
                </button>
              )}
            </div>
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
          </li>
        ))}
        {!cast.length && (
          <li className="text-dnd-parchment-muted text-xs">Nenhum personagem no elenco ainda.</li>
        )}
      </ul>

      {vaultAvailable.length > 0 && (
        <div className="space-y-2 rounded-lg border border-dnd-gold/20 bg-black/20 p-3">
          <p className="font-ui text-xs font-semibold text-dnd-gold">Importar do cofre</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1 font-ui text-xs text-dnd-parchment-muted">
              Herói
              <select
                value={importId}
                onChange={(e) => setImportId(e.target.value)}
                className="rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-sm text-dnd-parchment"
              >
                <option value="">Selecione…</option>
                {vaultAvailable.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name} — {c.characterClass} nv.{c.level}
                  </option>
                ))}
              </select>
            </label>
            <DndButton
              variant="outline"
              size="sm"
              loading={loading}
              disabled={!importId}
              onClick={handleImportFromVault}
            >
              Importar
            </DndButton>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <DndInput
          label="Nome (novo NPC)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Capitão Vorin"
        />
        <label className="flex flex-col gap-1 font-ui text-xs text-dnd-parchment-muted">
          Papel
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as CastRole)}
            className="rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-sm text-dnd-parchment"
          >
            {ROLE_OPTIONS.filter((o) => o.value !== 'pc').map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <DndButton variant="outline" size="sm" loading={loading} onClick={handleAdd}>
        Criar personagem no elenco
      </DndButton>
    </DndCard>
  );
}
