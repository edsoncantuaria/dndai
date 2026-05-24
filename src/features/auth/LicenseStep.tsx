'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AmbientBackground, DndButton, DndCard, DndHeading, DndInput } from '@/components/primitives';

export function LicenseStep() {
  const { activateLicense, logout, isActionLoading } = useAuth();
  const [licenseKey, setLicenseKey] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) return;
    await activateLicense(licenseKey);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <AmbientBackground variant="ember" />
      <DndCard padding="lg" className="relative z-10 w-full max-w-md">
        <DndHeading variant="section">Ativação de licença</DndHeading>
        <p className="mt-2 font-ui text-sm text-dnd-parchment-muted">
          Sua conta requer uma chave de licença para acessar a aventura.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <DndInput
            label="Chave de licença"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            required
          />
          <DndButton type="submit" variant="ember" className="w-full" loading={isActionLoading}>
            Ativar licença
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
