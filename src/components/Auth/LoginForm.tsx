'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Lock, UserRound } from 'lucide-react';

const LoginForm = () => {
    const { login, isActionLoading } = useAuth();
    const [loginIdentifier, setLoginIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
    const [formError, setFormError] = useState<string | null>(null);

    const loginError = fieldErrors.login?.[0];
    const passwordError = fieldErrors.password?.[0];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFieldErrors({});
        setFormError(null);

        const result = await login({ login: loginIdentifier, password });

        if (!result.success) {
            let fallbackFieldMessage: string | undefined;

            if (result.fieldErrors) {
                setFieldErrors(result.fieldErrors);
                const allErrors = Object.values(result.fieldErrors).flat();
                fallbackFieldMessage = allErrors[0];
            }

            const messageToShow = result.message || fallbackFieldMessage || 'Não foi possível entrar. Verifique seus dados.';
            setFormError(messageToShow);
            return;
        }

        setLoginIdentifier('');
        setPassword('');
        setFormError(null);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label htmlFor="login-identifier" className="block text-xs uppercase tracking-wide text-stone-400">
                    Email ou Usuário
                </label>
                <div className="relative mt-1">
                    <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-300" />
                    <input
                        id="login-identifier"
                        name="login"
                        type="text"
                        autoComplete="username"
                        required
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        aria-invalid={!!loginError}
                        aria-describedby={loginError ? 'login-error' : undefined}
                        className={`w-full pl-10 pr-3 py-3 bg-stone-900/60 border rounded-xl shadow-sm placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
                            loginError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-stone-700'
                        }`}
                    />
                </div>
                {loginError && (
                    <p id="login-error" className="mt-1 text-sm text-red-400">
                        {loginError}
                    </p>
                )}
            </div>

            <div>
                <label htmlFor="password-login" className="block text-xs uppercase tracking-wide text-stone-400">
                    Senha
                </label>
                <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-300" />
                    <input
                        id="password-login"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        aria-invalid={!!passwordError}
                        aria-describedby={passwordError ? 'password-error' : undefined}
                        className={`w-full pl-10 pr-3 py-3 bg-stone-900/60 border rounded-xl shadow-sm placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
                            passwordError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-stone-700'
                        }`}
                    />
                </div>
                {passwordError && (
                    <p id="password-error" className="mt-1 text-sm text-red-400">
                        {passwordError}
                    </p>
                )}
            </div>

            {formError && (
                <div className="rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {formError}
                </div>
            )}

            <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-stone-500">
                    <span>Acesso seguro com criptografia ponta a ponta.</span>
                    <button type="button" className="text-amber-300 hover:text-amber-200">Esqueceu a senha?</button>
                </div>
                <button
                    type="submit"
                    disabled={isActionLoading}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-2xl shadow-lg text-lg font-bold text-stone-900 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-stone-950 focus:ring-amber-500 disabled:opacity-50 transition-all"
                >
                    {isActionLoading ? <Loader2 className="animate-spin" /> : 'Entrar'}
                </button>
            </div>
        </form>
    );
};

export default LoginForm;
