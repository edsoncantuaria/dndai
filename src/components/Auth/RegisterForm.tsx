'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

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
                <label htmlFor="username" className="block text-sm font-medium text-stone-300">
                    Usuário
                </label>
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
                    className={`mt-1 w-full px-3 py-2 bg-stone-900/70 border rounded-md shadow-sm placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
                        usernameError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-stone-600'
                    }`}
                />
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
                <label htmlFor="email-register" className="block text-sm font-medium text-stone-300">
                    Email
                </label>
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
                    className={`mt-1 w-full px-3 py-2 bg-stone-900/70 border rounded-md shadow-sm placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
                        emailError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-stone-600'
                    }`}
                />
                {emailError && (
                    <p id="email-error" className="mt-1 text-sm text-red-400">
                        {emailError}
                    </p>
                )}
            </div>
            <div>
                <label htmlFor="password-register" className="block text-sm font-medium text-stone-300">
                    Senha
                </label>
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
                    className={`mt-1 w-full px-3 py-2 bg-stone-900/70 border rounded-md shadow-sm placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
                        passwordError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-stone-600'
                    }`}
                />
                {passwordError && (
                    <p id="password-register-error" className="mt-1 text-sm text-red-400">
                        {passwordError}
                    </p>
                )}
            </div>
            <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-stone-300">
                    Confirmar Senha
                </label>
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
                    className={`mt-1 w-full px-3 py-2 bg-stone-900/70 border rounded-md shadow-sm placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
                        confirmPasswordError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-stone-600'
                    }`}
                />
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

            <div>
                <button
                    type="submit"
                    disabled={isActionLoading}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-bold text-stone-900 bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-stone-800 focus:ring-amber-500 disabled:opacity-50"
                >
                     {isActionLoading ? <Loader2 className="animate-spin" /> : 'Registrar'}
                </button>
            </div>
        </form>
    );
};

export default RegisterForm;
