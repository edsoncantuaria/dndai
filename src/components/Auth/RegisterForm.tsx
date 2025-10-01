'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const RegisterForm = () => {
    const { register, isLoading } = useAuth();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = await register({ username, email, password, confirmPassword });
        if (success) {
            setUsername('');
            setEmail('');
            setPassword('');
            setConfirmPassword('');
        }
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
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1 w-full px-3 py-2 bg-stone-900/70 border border-stone-600 rounded-md shadow-sm placeholder-stone-500 focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                />
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
                    className="mt-1 w-full px-3 py-2 bg-stone-900/70 border border-stone-600 rounded-md shadow-sm placeholder-stone-500 focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                />
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
                    className="mt-1 w-full px-3 py-2 bg-stone-900/70 border border-stone-600 rounded-md shadow-sm placeholder-stone-500 focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                />
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
                    className="mt-1 w-full px-3 py-2 bg-stone-900/70 border border-stone-600 rounded-md shadow-sm placeholder-stone-500 focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                />
            </div>

            <div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-bold text-stone-900 bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-stone-800 focus:ring-amber-500 disabled:opacity-50"
                >
                     {isLoading ? <Loader2 className="animate-spin" /> : 'Registrar'}
                </button>
            </div>
        </form>
    );
};

export default RegisterForm;
