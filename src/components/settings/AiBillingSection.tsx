'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, KeyRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { DndButton, DndInput } from '@/components/primitives';

const GEMINI_STUDIO_URL = 'https://aistudio.google.com/apikey';

export function AiBillingSection() {
  const { aiAccess, saveApiKey, isActionLoading } = useAuth();
  const { apiKey } = useSettingsContext();
  const [draft, setDraft] = useState(apiKey);

  useEffect(() => {
    setDraft(apiKey);
  }, [apiKey]);

  const saveKey = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    await saveApiKey(trimmed);
  };

  const hasKey = aiAccess?.hasByok || Boolean(apiKey?.trim());

  return (
    <div className="space-y-4 pt-6 border-t border-white/10">
      <h3 className="text-lg font-semibold text-dnd-parchment flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-dnd-gold" />
        Chave Gemini (BYOK)
      </h3>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <p className="font-ui text-xs uppercase tracking-wider text-dnd-parchment-muted">
          Status
        </p>
        <p className="mt-1 font-semibold text-dnd-parchment">
          {hasKey ? 'Chave configurada' : 'Chave pendente — a mesa não narra sem BYOK'}
        </p>
      </div>

      <DndInput
        label="Chave API (Gemini / AI Studio)"
        id="settings-gemini-key"
        type="password"
        autoComplete="off"
        placeholder="AIza…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <p className="font-ui text-xs text-dnd-parchment-muted -mt-2">
        A mesma chave alimenta a narração do Mestre e o árbitro de plausibilidade das suas ações
        livres. Também fica neste navegador.{' '}
        <a
          href={GEMINI_STUDIO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-dnd-ember inline-flex items-center gap-1 hover:underline"
        >
          Obter chave
          <ExternalLink className="h-3 w-3" />
        </a>
        .
      </p>
      <DndButton variant="ghost" size="sm" onClick={saveKey} loading={isActionLoading}>
        Salvar chave Gemini
      </DndButton>
    </div>
  );
}
