'use client';

import React, { ReactNode } from 'react';
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
                return 'text-stone-900 bg-amber-600 hover:bg-amber-700';
            case 'destructive':
                return 'text-stone-100 bg-red-700 hover:bg-red-600';
            case 'secondary':
            default:
                return 'text-stone-200 bg-stone-700 hover:bg-stone-600';
        }
    }

    return (
        <div 
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fadeIn"
            style={{ animationDuration: '200ms' }}
            onClick={onClose}
        >
            <div 
                className="bg-stone-900 border border-amber-600/50 rounded-lg shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="p-4 border-b border-stone-700 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl font-bold font-garamond text-amber-300">{title}</h2>
                    <button onClick={onClose} className="text-stone-400 hover:text-white text-2xl">&times;</button>
                </header>
                <main className="p-6 overflow-y-auto">
                    {children}
                </main>
                {actions.length > 0 && (
                    <footer className="p-4 flex justify-end items-center gap-4 bg-stone-950/50 rounded-b-lg flex-shrink-0">
                        {actions.map((action, index) => (
                            <button
                                key={index}
                                onClick={action.onClick}
                                disabled={action.disabled}
                                className={`px-4 py-2 rounded-md font-semibold transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${getButtonClass(action.variant)}`}
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
