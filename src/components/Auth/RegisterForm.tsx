'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, UserRound, Mail, Lock } from 'lucide-react';

const RegisterForm = () => {
    const { register, isActionLoading } = useAuth();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
    const [formError, setFormError] = useState<string | null>(null);
    
    const usernameError = fieldErrors.username?.[0];
    const emailError = fieldErrors.email?.[0];
    const passwordError = fieldErrors.password?.[0];
    const confirmPasswordError = fieldErrors.confirmPassword?.[0];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFieldErrors({});
        setFormError(null);

        const result = await register({ username, email, password, confirmPassword });
        if (result.success) {
            // A mensagem de sucesso agora é mostrada por um toast no AuthContext.
            // Limpar o formulário é uma boa prática.
            setUsername('');
            setEmail('');
            setPassword('');
            setConfirmPassword('');
            return;
        }

        let fallbackFieldMessage: string | undefined;

        if (result.fieldErrors) {
            setFieldErrors(result.fieldErrors);
            const allErrors = Object.values(result.fieldErrors).flat();
            fallbackFieldMessage = allErrors[0];
        }

        const messageToShow = result.message || fallbackFieldMessage || 'Não foi possível concluir o cadastro.';
        setFormError(messageToShow);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="username" className="block text-xs uppercase tracking-wide text-stone-400">
                    Usuário
                </label>
                <div className="relative mt-1">
                <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-300" />
                <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    minLength={2}
                    maxLength={30}
                    pattern="[A-Za-z0-9]+"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    aria-invalid={!!usernameError}
                    aria-describedby={usernameError ? 'username-error' : undefined}
                    className={`w-full pl-10 pr-3 py-3 bg-stone-900/60 border rounded-xl shadow-sm placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
                        usernameError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-stone-700'
                    }`}
                />
                </div>
                <p className="mt-1 text-xs text-stone-400">
                    Use apenas letras e números (2 a 30 caracteres).
                </p>
                {usernameError && (
                    <p id="username-error" className="mt-1 text-sm text-red-400">
                        {usernameError}
                    </p>
                )}
            </div>
            <div>
                <label htmlFor="email-register" className="block text-xs uppercase tracking-wide text-stone-400">
                    Email
                </label>
                <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-300" />
                <input
                    id="email-register"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={!!emailError}
                    aria-describedby={emailError ? 'email-error' : undefined}
                    className={`w-full pl-10 pr-3 py-3 bg-stone-900/60 border rounded-xl shadow-sm placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
                        emailError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-stone-700'
                    }`}
                />
                </div>
                {emailError && (
                    <p id="email-error" className="mt-1 text-sm text-red-400">
                        {emailError}
                    </p>
                )}
            </div>
            <div>
                <label htmlFor="password-register" className="block text-xs uppercase tracking-wide text-stone-400">
                    Senha
                </label>
                <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-300" />
                <input
                    id="password-register"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={!!passwordError}
                    aria-describedby={passwordError ? 'password-register-error' : undefined}
                    className={`w-full pl-10 pr-3 py-3 bg-stone-900/60 border rounded-xl shadow-sm placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
                        passwordError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-stone-700'
                    }`}
                />
                </div>
                {passwordError && (
                    <p id="password-register-error" className="mt-1 text-sm text-red-400">
                        {passwordError}
                    </p>
                )}
            </div>
            <div>
                <label htmlFor="confirm-password" className="block text-xs uppercase tracking-wide text-stone-400">
                    Confirmar Senha
                </label>
                <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-300" />
                <input
                    id="confirm-password"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    aria-invalid={!!confirmPasswordError}
                    aria-describedby={confirmPasswordError ? 'confirm-password-error' : undefined}
                    className={`w-full pl-10 pr-3 py-3 bg-stone-900/60 border rounded-xl shadow-sm placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
                        confirmPasswordError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-stone-700'
                    }`}
                />
                </div>
                {confirmPasswordError && (
                    <p id="confirm-password-error" className="mt-1 text-sm text-red-400">
                        {confirmPasswordError}
                    </p>
                )}
            </div>

            {formError && (
                <div className="rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {formError}
                </div>
            )}

            <div className="pt-2">
                <button
                    type="submit"
                    disabled={isActionLoading}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-2xl shadow-lg text-lg font-bold text-stone-900 bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-stone-950 focus:ring-emerald-400 disabled:opacity-50 transition-all"
                >
                     {isActionLoading ? <Loader2 className="animate-spin" /> : 'Registrar'}
                </button>
            </div>
        </form>
    );
};

export default RegisterForm;
