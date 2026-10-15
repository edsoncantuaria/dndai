'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { AmbientBackground, DndButton, DndCard, DndHeading, DndInput } from '@/components/primitives';

const GEMINI_STUDIO_URL = 'https://aistudio.google.com/apikey';

export function ApiKeyStep() {
  const { saveApiKey, logout, isActionLoading } = useAuth();
  const { apiKey } = useSettingsContext();
  const [key, setKey] = useState(() => apiKey);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    await saveApiKey(key);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <AmbientBackground variant="parchment" />
      <DndCard padding="lg" className="relative z-10 w-full max-w-md">
        <DndHeading variant="section">Chave Gemini</DndHeading>
        <p className="mt-2 font-ui text-sm text-dnd-parchment-muted">
          Licença ativa! Informe sua chave do Google AI Studio para o Mestre narrar a aventura.
          Ela fica associada à sua conta para a mesa funcionar.
        </p>
        <a
          href={GEMINI_STUDIO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block font-ui text-xs text-dnd-gold hover:underline"
        >
          Criar chave gratuita no AI Studio
        </a>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <DndInput
            label="Chave da API (Gemini)"
            type="password"
            autoComplete="off"
            placeholder="AIza…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            required
          />
          <DndButton type="submit" variant="ember" className="w-full" loading={isActionLoading}>
            Salvar e continuar
          </DndButton>
        </form>
        <button
          type="button"
          onClick={logout}
          className="mt-4 w-full font-ui text-sm text-dnd-parchment-muted hover:text-dnd-parchment"
        >
          Sair
        </button>
      </DndCard>
    </div>
  );
}
