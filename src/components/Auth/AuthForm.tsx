'use client';
import { useState } from 'react';
import { Sparkles, Shield, Swords, Compass } from 'lucide-react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

const highlights = [
    {
        title: 'Mesa viva e responsiva',
        description: 'A IA mantém o mundo coerente, registra fatos e sincroniza com seus personagens.',
        icon: <Sparkles className="h-5 w-5 text-amber-300" />
    },
    {
        title: 'Regras no lugar',
        description: 'Combates, loot e XP seguem o livro básico de D&D com salvaguardas.',
        icon: <Shield className="h-5 w-5 text-amber-300" />
    },
    {
        title: 'Aventura colaborativa',
        description: 'Traga a sua mesa inteira ou jogue solo com suporte a múltiplos heróis.',
        icon: <Swords className="h-5 w-5 text-amber-300" />
    },
    {
        title: 'Exploração guiada',
        description: 'Receba sugestões inteligentes de ações e um diário automático da jornada.',
        icon: <Compass className="h-5 w-5 text-amber-300" />
    },
];

const AuthForm = () => {
    const [isLoginView, setIsLoginView] = useState(true);

    return (
        <div className="relative min-h-screen overflow-x-hidden overflow-y-auto bg-[#04070f]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.25),_transparent_55%)]" />
            <div className="absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-amber-500/10 via-transparent to-transparent blur-3xl" />

            <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-8 py-10 flex flex-col lg:flex-row gap-10">
                <section className="w-full lg:w-1/2 space-y-6 text-stone-200">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-400/40 bg-amber-500/10 text-[11px] uppercase tracking-[0.4em] text-amber-200">
                        Mesa narrativa com IA
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-3xl md:text-4xl font-bold font-serif text-white leading-tight">Forje crônicas épicas em minutos</h1>
                        <p className="text-sm md:text-base text-stone-300">
                            Automação de combate, inventário inteligente e ambientação dinâmica em uma experiência premium.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {highlights.map(feature => (
                            <div key={feature.title} className="rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm p-4 flex items-start gap-3">
                                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-400/30">
                                    {feature.icon}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">{feature.title}</p>
                                    <p className="text-xs text-stone-400 leading-relaxed">{feature.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="w-full lg:w-1/2 flex justify-center">
                    <div className="w-full max-w-md rounded-3xl border border-amber-500/30 bg-stone-950/80 p-6 sm:p-8 shadow-[0_25px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.4em] text-amber-200">Portal do jogador</p>
                                <h2 className="text-3xl font-bold text-white mt-1">
                                    {isLoginView ? 'Entrar' : 'Registrar'}
                                </h2>
                            </div>
                            <div className="grid grid-cols-2 p-1 rounded-full border border-stone-700 bg-stone-900/70 text-sm font-semibold text-stone-400 w-full sm:w-auto">
                                <button
                                    onClick={() => setIsLoginView(true)}
                                    className={`px-4 py-1 rounded-full transition-all ${isLoginView ? 'bg-amber-400 text-stone-900 shadow-lg' : ''}`}
                                >
                                    Login
                                </button>
                                <button
                                    onClick={() => setIsLoginView(false)}
                                    className={`px-4 py-1 rounded-full transition-all ${!isLoginView ? 'bg-amber-400 text-stone-900 shadow-lg' : ''}`}
                                >
                                    Cadastro
                                </button>
                            </div>
                        </div>

                        <p className="text-sm text-stone-400">
                            {isLoginView
                                ? 'Use o e-mail ou usuário cadastrado para retomar sua mesa instantaneamente.'
                                : 'Crie sua conta em segundos e sincronize personagens, homebrews e mesas.'}
                        </p>

                        {isLoginView ? <LoginForm /> : <RegisterForm />}

                        <p className="text-center text-xs text-stone-500">
                            Ao continuar você concorda com as diretrizes da comunidade e o código de conduta da mesa.
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default AuthForm;
