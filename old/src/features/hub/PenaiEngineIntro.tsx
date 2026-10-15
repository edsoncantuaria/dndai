'use client';

import { Cpu, Moon, Sparkles } from 'lucide-react';
import { DndCard } from '@/components/primitives';

const CARDS = [
    {
        icon: Cpu,
        title: 'Motor de regras',
        body: 'Dados, HP e loot são decididos antes da prosa. Nada de números inventados pela IA.',
    },
    {
        icon: Sparkles,
        title: 'Narrador',
        body: 'A IA descreve o que o motor já decidiu — como um mestre lendo a mesa.',
    },
    {
        icon: Moon,
        title: 'Mundo offline',
        body: 'Facções, rumores e missões evoluem enquanto você descansa entre sessões.',
    },
] as const;

export function PenaiEngineIntro() {
    return (
        <section className="mb-10">
            <div className="mb-4">
                <p className="font-ui text-[11px] font-bold uppercase tracking-[0.28em] text-dnd-ember">
                    Como sua campanha vive
                </p>
                <h2 className="mt-1 font-display text-2xl text-dnd-parchment sm:text-3xl">
                    Três camadas, uma aventura
                </h2>
                <p className="mt-2 max-w-2xl font-narrative text-sm text-dnd-parchment-muted">
                    Crônicas de Aventuras usa o motor PENAI: regras primeiro, narração depois, e um
                    mundo que respira mesmo quando você não está na mesa.
                </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
                {CARDS.map(card => (
                    <DndCard key={card.title} padding="md" hover={false}>
                        <card.icon className="h-5 w-5 text-dnd-gold" aria-hidden />
                        <h3 className="mt-2 font-display text-lg text-dnd-parchment">{card.title}</h3>
                        <p className="mt-2 font-narrative text-sm leading-relaxed text-dnd-parchment/80">
                            {card.body}
                        </p>
                    </DndCard>
                ))}
            </div>
        </section>
    );
}
