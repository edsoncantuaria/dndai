'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const LoginForm = () => {
    const { login, isLoading } = useAuth();
    const [loginIdentifier, setLoginIdentifier] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await login({ login: loginIdentifier, password });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label htmlFor="login-identifier" className="block text-sm font-medium text-stone-300">
                    Email
                </label>
                <div className="mt-1">
                    <input
                        id="login-identifier"
                        name="login"
                        type="email"
                        autoComplete="email"
                        required
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        className="w-full px-3 py-2 bg-stone-900/70 border border-stone-600 rounded-md shadow-sm placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                </div>
            </div>

            <div>
                <label htmlFor="password-login" className="block text-sm font-medium text-stone-300">
                    Senha
                </label>
                <div className="mt-1">
                    <input
                        id="password-login"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-stone-900/70 border border-stone-600 rounded-md shadow-sm placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                </div>
            </div>

            <div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-bold text-stone-900 bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-stone-800 focus:ring-amber-500 disabled:opacity-50"
                >
                    {isLoading ? <Loader2 className="animate-spin" /> : 'Entrar'}
                </button>
            </div>
        </form>
    );
};

export default LoginForm;
