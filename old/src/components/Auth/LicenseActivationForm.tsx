'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const LicenseActivationForm = () => {
    const { activateLicense, logout, isActionLoading } = useAuth();
    const [licenseKey, setLicenseKey] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!licenseKey.trim()) return;
        await activateLicense(licenseKey);
    };

    return (
        <div className="w-full max-w-md p-8 space-y-6 bg-stone-800/50 rounded-lg shadow-lg border border-stone-700">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-amber-300 font-serif">Ativação de Licença</h1>
                <p className="mt-2 text-stone-400">
                    Sua conta foi criada, mas requer uma chave de licença para acessar a aventura.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="license-key" className="block text-sm font-medium text-stone-300">
                        Chave de Licença
                    </label>
                    <div className="mt-1">
                        <input
                            id="license-key"
                            name="license-key"
                            type="text"
                            required
                            value={licenseKey}
                            onChange={(e) => setLicenseKey(e.target.value)}
                            className="w-full px-3 py-2 bg-stone-900/70 border border-stone-600 rounded-md shadow-sm placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>
                </div>

                <div>
                    <button
                        type="submit"
                        disabled={isActionLoading || !licenseKey.trim()}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-bold text-stone-900 bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-stone-800 focus:ring-amber-500 disabled:opacity-50"
                    >
                        {isActionLoading ? <Loader2 className="animate-spin" /> : 'Ativar Licença'}
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

export default LicenseActivationForm;
