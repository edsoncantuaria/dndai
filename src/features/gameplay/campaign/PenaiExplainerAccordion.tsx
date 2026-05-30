'use client';

import { ChevronDown, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { DndCard } from '@/components/primitives';

const LAYERS = [
    {
        title: 'Motor de regras',
        body: 'HP, loot, viagem e combate são decididos antes da prosa. A IA não inventa números na sua ficha.',
    },
    {
        title: 'Narrador',
        body: 'A inteligência artificial descreve o que já aconteceu — como um mestre lendo o resultado dos dados.',
    },
    {
        title: 'Mundo offline',
        body: 'Facções, rumores e missões evoluem enquanto você descansa. Sua campanha continua mesmo entre sessões.',
    },
] as const;

export function PenaiExplainerAccordion() {
    const [open, setOpen] = useState(false);

    return (
        <DndCard padding="md" hover={false}>
            <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left"
                onClick={() => setOpen(v => !v)}
                aria-expanded={open}
            >
                <p className="flex items-center gap-2 font-ui text-[10px] uppercase tracking-wider text-dnd-gold">
                    <Sparkles className="h-4 w-4" />
                    Como sua campanha vive
                </p>
                <ChevronDown
                    className={`h-4 w-4 text-dnd-gold/70 transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open ? (
                <ul className="mt-3 space-y-3">
                    {LAYERS.map(layer => (
                        <li
                            key={layer.title}
                            className="rounded border border-dnd-gold/10 bg-black/20 px-3 py-2"
                        >
                            <p className="font-ui text-xs font-semibold text-dnd-ember">{layer.title}</p>
                            <p className="mt-1 font-narrative text-xs leading-relaxed text-dnd-parchment/85">
                                {layer.body}
                            </p>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-2 font-narrative text-xs text-dnd-parchment/60">
                    Motor · Narração · Mundo que respira entre turnos
                </p>
            )}
        </DndCard>
    );
}
