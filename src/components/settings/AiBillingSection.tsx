'use client';

import { useEffect, useState } from 'react';
import { Coins, ExternalLink, KeyRound } from 'lucide-react';
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

  return (
    <div className="space-y-4 pt-6 border-t border-white/10">
      <h3 className="text-lg font-semibold text-dnd-parchment flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-dnd-gold" />
        IA na mesa (BYOK e créditos)
      </h3>

      {aiAccess ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="font-ui text-xs uppercase tracking-wider text-dnd-parchment-muted">
              Modo atual
            </p>
            <p className="mt-1 font-semibold text-dnd-parchment">
              {aiAccess.billingMode === 'byok'
                ? 'Sua chave (BYOK)'
                : aiAccess.billingMode === 'platform_credits'
                  ? 'Créditos da plataforma'
                  : 'Indisponível'}
            </p>
          </div>
          {aiAccess.platformBillingEnabled ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4">
              <p className="font-ui text-xs uppercase tracking-wider text-emerald-400/80 flex items-center gap-1">
                <Coins className="h-3.5 w-3.5" />
                Créditos restantes
              </p>
              <p className="mt-1 text-2xl font-display text-dnd-parchment">
                {aiAccess.creditsRemaining}
              </p>
              <p className="font-ui text-xs text-dnd-parchment-muted">
                Usados: {aiAccess.creditsUsed}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

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
        . Com BYOK ativo, créditos inclusos não são consumidos.
      </p>
      <DndButton variant="ghost" size="sm" onClick={saveKey} loading={isActionLoading}>
        Salvar chave Gemini
      </DndButton>
    </div>
  );
}
