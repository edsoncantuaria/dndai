'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AmbientBackground, DndButton, DndCard, DndHeading, DndInput } from '@/components/primitives';

export function ApiKeyStep() {
  const { saveApiKey, logout, isActionLoading } = useAuth();
  const [key, setKey] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    await saveApiKey(key);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <AmbientBackground variant="parchment" />
      <DndCard padding="lg" className="relative z-10 w-full max-w-md">
        <DndHeading variant="section">Chave de API Gemini</DndHeading>
        <p className="mt-2 font-ui text-sm text-dnd-parchment-muted">
          Licença ativa! Informe sua chave do Google AI Studio para o mestre virtual narrar.
        </p>
        <a
          href="https://aistudio.google.com/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block font-ui text-xs text-dnd-gold hover:underline"
        >
          Como obter uma chave?
        </a>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <DndInput
            label="Chave da API"
            type="password"
            autoComplete="off"
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
