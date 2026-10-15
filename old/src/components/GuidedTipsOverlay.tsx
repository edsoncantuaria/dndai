// src/components/GuidedTipsOverlay.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpenCheck, ChevronLeft, ChevronRight, Check } from 'lucide-react';

const tips: Array<{ title: string; detail: string; selector?: string }> = [
    {
        title: 'Narrativa Viva',
        detail: 'O painel central mostra a narração do Mestre e registra decisões importantes. Você pode responder com ações rápidas ou escrever sua própria descrição.',
        selector: '[data-tour-id="log"]',
    },
    {
        title: 'Painel de Contexto',
        detail: 'Os “Fatos Atualizados” reúnem NPCs ativos, missões e eventos recentes. No mobile, abra o botão “Fatos Recentes” para acessar o mesmo conteúdo.',
        selector: '[data-tour-id="facts"]',
    },
    {
        title: 'HUD Sempre Visível',
        detail: 'A barra superior acompanha Vida, CA, Pontos de Ação e XP. Use-a para decidir se descansa, luta ou foge sem abrir outras abas.',
        selector: '[data-tour-id="hud"]',
    },
    {
        title: 'Ações e Rolagens',
        detail: 'Use os botões sugeridos para interagir rápido ou descreva sua própria ação. Quando o Mestre pedir dados, o modal de rolamento aparece automaticamente.',
        selector: '[data-tour-id="actions"]',
    },
];

interface GuidedTipsOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    initialStep?: number;
    onStepChange?: (step: number) => void;
    onComplete?: () => void;
}

const GuidedTipsOverlay: React.FC<GuidedTipsOverlayProps> = ({ isOpen, onClose, initialStep = 0, onStepChange, onComplete }) => {
    const [step, setStep] = useState(initialStep);
    const [spotlightRect, setSpotlightRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

    useEffect(() => {
        if (isOpen) {
            const safeStep = Math.min(Math.max(initialStep, 0), tips.length - 1);
            setStep(safeStep);
        }
    }, [initialStep, isOpen]);

    const updateSpotlight = useCallback(() => {
        if (typeof document === 'undefined') return;
        if (!isOpen) {
            setSpotlightRect(null);
            return;
        }
        const selector = tips[step]?.selector;
        if (!selector) {
            setSpotlightRect(null);
            return;
        }
        const element = document.querySelector(selector) as HTMLElement | null;
        if (!element) {
            setSpotlightRect(null);
            return;
        }
        const rect = element.getBoundingClientRect();
        setSpotlightRect({
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
        });
    }, [step, isOpen]);

    useEffect(() => {
        if (!isOpen) {
            setSpotlightRect(null);
            return;
        }
        updateSpotlight();
        const handleWindowChange = () => updateSpotlight();
        window.addEventListener('resize', handleWindowChange);
        window.addEventListener('scroll', handleWindowChange, true);
        return () => {
            window.removeEventListener('resize', handleWindowChange);
            window.removeEventListener('scroll', handleWindowChange, true);
        };
    }, [isOpen, updateSpotlight]);

    const notifyStepChange = (nextStep: number) => {
        setStep(nextStep);
        onStepChange?.(nextStep);
    };

    const handleNext = () => {
        if (step < tips.length - 1) {
            notifyStepChange(step + 1);
        } else {
            onComplete?.();
        }
    };

    const handlePrev = () => {
        if (step > 0) {
            notifyStepChange(step - 1);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />
                    {spotlightRect && (
                        <motion.div
                            className="pointer-events-none fixed border-2 border-amber-400 rounded-2xl shadow-[0_0_35px_rgba(251,191,36,0.6)]"
                            style={{
                                top: spotlightRect.top,
                                left: spotlightRect.left,
                                width: Math.max(spotlightRect.width, 80),
                                height: Math.max(spotlightRect.height, 60),
                                zIndex: 45,
                            }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        />
                    )}
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center px-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                    <motion.div
                        className="relative w-full max-w-2xl rounded-2xl border border-amber-500/40 bg-stone-950/90 p-6 shadow-2xl text-stone-100"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                    >
                        <div className="flex items-center gap-2 text-amber-200 uppercase text-xs font-semibold tracking-wider">
                            <BookOpenCheck className="h-4 w-4" />
                            Guia rápido
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-4">
                            <h2 className="text-2xl font-bold font-garamond">{tips[step].title}</h2>
                            <button
                                onClick={onClose}
                                className="text-sm text-stone-400 hover:text-stone-200 transition-colors"
                                aria-label="Fechar guia"
                            >
                                Fechar
                            </button>
                        </div>
                        <p className="mt-3 text-stone-300 leading-relaxed">{tips[step].detail}</p>

                        <div className="mt-6 flex items-center justify-between text-xs uppercase tracking-widest text-stone-500">
                            {tips.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`h-1 flex-1 mx-1 rounded-full ${idx <= step ? 'bg-amber-400' : 'bg-stone-700'}`}
                                />
                            ))}
                        </div>

                        <div className="mt-6 flex items-center justify-between">
                            <button
                                onClick={handlePrev}
                                disabled={step === 0}
                                className="inline-flex items-center gap-1 rounded-full border border-stone-700 px-4 py-2 text-sm text-stone-300 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="h-4 w-4" /> Voltar
                            </button>
                            <button
                                onClick={handleNext}
                                className="inline-flex items-center gap-2 rounded-full bg-amber-500/90 px-5 py-2 text-sm font-semibold text-stone-900 hover:bg-amber-400"
                            >
                                {step === tips.length - 1 ? (
                                    <>
                                        Concluir <Check className="h-4 w-4" />
                                    </>
                                ) : (
                                    <>
                                        Avançar <ChevronRight className="h-4 w-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default GuidedTipsOverlay;
