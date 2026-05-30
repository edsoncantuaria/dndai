'use client';

import { useState } from 'react';
import { KeyRound, Coins, ExternalLink } from 'lucide-react';
import { DndButton, DndInput } from '@/components/primitives';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { writeAiApiKey } from '@/lib/aiApiKeyStorage';
import type { AiAccessStatus } from '@/types/aiAccess';

const GEMINI_STUDIO_URL = 'https://aistudio.google.com/apikey';

function canProceed(access: AiAccessStatus | null, localKey: string): boolean {
  if (!access) return localKey.trim().length > 8;
  if (localKey.trim().length > 8) return true;
  return access.canInfer;
}

export function AiAccessStep({ onContinue }: { onContinue: () => void }) {
  const { apiKey, setApiKey } = useSettingsContext();
  const { aiAccess, setAiAccess } = useOnboarding();
  const [draftKey, setDraftKey] = useState(apiKey);
  const [error, setError] = useState<string | null>(null);

  const handleSaveKey = () => {
    const trimmed = draftKey.trim();
    setApiKey(trimmed);
    writeAiApiKey(trimmed);
    if (trimmed) {
      setAiAccess(
        aiAccess
          ? {
              ...aiAccess,
              hasByok: true,
              billingMode: 'byok',
              canInfer: true,
            }
          : null,
      );
    }
    setError(null);
  };

  const proceed = () => {
    const trimmed = draftKey.trim();
    if (trimmed) {
      setApiKey(trimmed);
      writeAiApiKey(trimmed);
    }
    if (!canProceed(aiAccess, trimmed)) {
      setError(
        'Configure sua chave Gemini (BYOK) ou aguarde créditos inclusos. Sem isso a mesa não narra.',
      );
      return;
    }
    onContinue();
  };

  return (
    <div className="space-y-5 text-left">
      <p className="font-narrative text-base leading-relaxed text-dnd-parchment-muted">
        O jogo usa <strong className="text-dnd-parchment">Gemini</strong> para narrar. Cole sua chave do
        Google AI Studio (BYOK) — ela fica só neste aparelho. Créditos da plataforma são opcionais.
      </p>

      {aiAccess && aiAccess.platformBillingEnabled ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-950/30 px-4 py-3">
          <Coins className="h-8 w-8 shrink-0 text-emerald-400" />
          <div>
            <p className="font-ui text-sm font-semibold text-dnd-parchment">
              Créditos inclusos: {aiAccess.creditsRemaining}
            </p>
            <p className="font-ui text-xs text-dnd-parchment-muted">
              Cada turno narrado consome 1 crédito quando você não usa BYOK.
            </p>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-dnd-gold/20 bg-dnd-obsidian/60 p-4">
        <div className="mb-3 flex items-center gap-2 font-ui text-sm font-semibold text-dnd-gold">
          <KeyRound className="h-4 w-4" />
          Chave Gemini (BYOK) — recomendado
        </div>
        <DndInput
          label="API Key"
          id="onboarding-gemini-key"
          type="password"
          autoComplete="off"
          placeholder="AIza…"
          value={draftKey}
          onChange={(e) => setDraftKey(e.target.value)}
        />
        <p className="mt-2 font-ui text-xs text-dnd-parchment-muted">
          A chave fica só no seu navegador. Obtenha em{' '}
          <a
            href={GEMINI_STUDIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-dnd-ember hover:underline"
          >
            Google AI Studio
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
        <DndButton variant="ghost" size="sm" className="mt-3" onClick={handleSaveKey}>
          Salvar chave localmente
        </DndButton>
      </div>

      {error ? <p className="font-ui text-sm text-red-400">{error}</p> : null}

      <DndButton variant="ember" size="lg" className="w-full" onClick={proceed}>
        Continuar
      </DndButton>
    </div>
  );
}
