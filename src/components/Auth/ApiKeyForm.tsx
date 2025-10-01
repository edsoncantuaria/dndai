'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const ApiKeyForm = () => {
    const { saveApiKey, logout, isLoading } = useAuth();
    const [apiKey, setApiKey] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!apiKey.trim()) return;
        await saveApiKey(apiKey);
    };

    return (
        <div className="w-full max-w-md p-8 space-y-6 bg-stone-800/50 rounded-lg shadow-lg border border-stone-700">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-amber-300 font-serif">Configurar Chave de API</h1>
                <p className="mt-2 text-stone-400">
                    Sua licença está ativa! Para jogar, você precisa fornecer sua própria chave de API do Google AI Studio.
                </p>
                 <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 hover:text-amber-300 underline mt-1 inline-block">
                    Como Obter uma Chave de API?
                </a>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="api-key" className="block text-sm font-medium text-stone-300">
                        Chave da API do Google
                    </label>
                    <div className="mt-1">
                        <input
                            id="api-key"
                            name="api-key"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="w-full px-3 py-2 bg-stone-900/70 border border-stone-600 rounded-md shadow-sm placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>
                </div>

                <div>
                    <button
                        type="submit"
                        disabled={isLoading || !apiKey.trim()}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-bold text-stone-900 bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-stone-800 focus:ring-amber-500 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="animate-spin" /> : 'Salvar e Jogar'}
                    </button>
                </div>
            </form>
             <div className="text-center">
                <button onClick={logout} className="text-sm text-stone-400 hover:text-stone-200 hover:underline">
                    Sair
                </button>
            </div>
        </div>
    );
};

export default ApiKeyForm;
