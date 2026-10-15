'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DndButton, DndInput } from '@/components/primitives';

export interface RegisterFormV2Props {
  onSwitchToLogin?: () => void;
}

export function RegisterFormV2({ onSwitchToLogin }: RegisterFormV2Props) {
  const { register, isActionLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    if (!acceptedTerms) {
      setFormError('Aceite os termos para continuar.');
      return;
    }

    const result = await register({ username, email, password, confirmPassword });
    if (result.success) {
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      onSwitchToLogin?.();
      return;
    }

    if (result.fieldErrors) setFieldErrors(result.fieldErrors);
    const fallback = result.fieldErrors ? Object.values(result.fieldErrors).flat()[0] : undefined;
    setFormError(result.message || fallback || 'Não foi possível concluir o cadastro.');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <DndInput
        label="Usuário"
        id="username-v2"
        required
        minLength={2}
        maxLength={30}
        pattern="[A-Za-z0-9]+"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        error={fieldErrors.username?.[0]}
      />
      <p className="-mt-2 font-ui text-xs text-dnd-parchment/85">Letras e números, 2–30 caracteres.</p>
      <DndInput
        label="Email"
        id="email-v2"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email?.[0]}
      />
      <DndInput
        label="Senha"
        id="password-reg-v2"
        type="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password?.[0]}
      />
      <DndInput
        label="Confirmar senha"
        id="confirm-v2"
        type="password"
        autoComplete="new-password"
        required
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={fieldErrors.confirmPassword?.[0]}
      />
      <label className="flex cursor-pointer items-start gap-2 font-ui text-sm leading-snug text-dnd-parchment">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 rounded border-dnd-gold/50 bg-dnd-obsidian-raised accent-dnd-ember"
        />
        <span>
          Concordo com as diretrizes da comunidade e entendo que a chave de API Gemini será necessária para
          jogar.
        </span>
      </label>
      {formError ? (
        <p className="rounded-md border border-dnd-danger/50 bg-dnd-danger/10 px-3 py-2 font-ui text-sm text-red-200">
          {formError}
        </p>
      ) : null}
      <DndButton type="submit" variant="ember" className="w-full" loading={isActionLoading}>
        Registrar
      </DndButton>
      {onSwitchToLogin ? (
        <p className="text-center font-ui text-sm text-dnd-parchment/90">
          Já tem conta?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-dnd-gold underline-offset-2 hover:underline"
          >
            Entrar
          </button>
        </p>
      ) : null}
    </form>
  );
}
