'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DndButton, DndInput } from '@/components/primitives';

export interface LoginFormV2Props {
  onSwitchToRegister?: () => void;
}

export function LoginFormV2({ onSwitchToRegister }: LoginFormV2Props) {
  const { login, isActionLoading } = useAuth();
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const result = await login({ login: loginIdentifier, password });
    if (!result.success) {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      const fallback = result.fieldErrors
        ? Object.values(result.fieldErrors).flat()[0]
        : undefined;
      setFormError(result.message || fallback || 'Não foi possível entrar. Verifique seus dados.');
      return;
    }
    setLoginIdentifier('');
    setPassword('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DndInput
        label="Email ou usuário"
        id="login-v2"
        autoComplete="username"
        required
        value={loginIdentifier}
        onChange={(e) => setLoginIdentifier(e.target.value)}
        error={fieldErrors.login?.[0]}
      />
      <DndInput
        label="Senha"
        id="password-v2"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password?.[0]}
      />
      {formError ? (
        <p className="rounded-md border border-dnd-danger/50 bg-dnd-danger/10 px-3 py-2 font-ui text-sm text-red-200">
          {formError}
        </p>
      ) : null}
      <DndButton type="submit" variant="ember" className="w-full" loading={isActionLoading}>
        Entrar
      </DndButton>
      {onSwitchToRegister ? (
        <p className="text-center font-ui text-sm text-dnd-parchment/90">
          Novo na mesa?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-dnd-gold underline-offset-2 hover:underline"
          >
            Criar conta
          </button>
        </p>
      ) : null}
    </form>
  );
}
