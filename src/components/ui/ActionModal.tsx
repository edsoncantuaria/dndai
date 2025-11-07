'use client';

import React, { ReactNode, useId } from 'react';
import { Loader2 } from 'lucide-react';

export interface ActionButton {
    text: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'destructive';
    disabled?: boolean;
    icon?: ReactNode;
}

interface ActionModalProps {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    children: ReactNode;
    actions: ActionButton[];
}

const ActionModal: React.FC<ActionModalProps> = ({
    isOpen,
    title,
    onClose,
    children,
    actions = []
}) => {
    if (!isOpen) return null;

    const getButtonClass = (variant: ActionButton['variant']) => {
        switch (variant) {
            case 'primary':
                return 'text-stone-900 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400';
            case 'destructive':
                return 'text-stone-100 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500';
            case 'secondary':
            default:
                return 'text-stone-200 border border-white/15 bg-white/5 hover:border-amber-200/40';
        }
    }

    const titleId = useId();

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
            style={{ animationDuration: '200ms' }}
            onClick={onClose}
        >
            <div 
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="relative w-full max-w-xl flex flex-col max-h-[90vh] rounded-3xl border border-amber-500/20 bg-[#080b12]/95 shadow-[0_30px_80px_rgba(0,0,0,0.65)] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="p-6 border-b border-white/5 flex items-start justify-between gap-4 flex-shrink-0">
                    <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-amber-400">Ação necessária</p>
                        <h2 id={titleId} className="text-2xl font-semibold text-white mt-1">{title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-stone-400 hover:text-white transition-colors rounded-full border border-white/10 w-10 h-10 flex items-center justify-center"
                    >
                        &times;
                    </button>
                </header>
                <main className="p-6 overflow-y-auto text-stone-200 text-sm leading-relaxed">
                    {children}
                </main>
                {actions.length > 0 && (
                    <footer className="p-6 flex flex-wrap justify-end items-center gap-3 border-t border-white/5 bg-white/5 flex-shrink-0">
                        {actions.map((action, index) => (
                            <button
                                key={index}
                                onClick={action.onClick}
                                disabled={action.disabled}
                                className={`px-4 py-2 rounded-full font-semibold transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${getButtonClass(action.variant)}`}
                            >
                                {action.disabled ? <Loader2 className="h-4 w-4 animate-spin"/> : action.icon}
                                {action.text}
                            </button>
                        ))}
                    </footer>
                )}
            </div>
        </div>
    );
};

export default ActionModal;
