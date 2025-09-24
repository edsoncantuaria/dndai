'use client';

import React from 'react';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = "Confirmar",
    cancelText = "Cancelar"
}) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fadeIn"
            style={{ animationDuration: '200ms' }}
        >
            <div className="bg-stone-900 border border-amber-600/50 rounded-lg shadow-2xl w-full max-w-md">
                <header className="p-4 border-b border-stone-700">
                    <h2 className="text-xl font-bold font-garamond text-amber-300">{title}</h2>
                </header>
                <main className="p-6">
                    <p className="text-stone-300 whitespace-pre-wrap">{message}</p>
                </main>
                <footer className="p-4 flex justify-end items-center gap-4 bg-stone-950/50 rounded-b-lg">
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 rounded-md text-stone-200 bg-stone-700 hover:bg-stone-600 transition-colors"
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 rounded-md transition-colors font-semibold ${onCancel ? 'text-stone-900 bg-red-700 hover:bg-red-600' : 'text-stone-900 bg-amber-600 hover:bg-amber-700'}`}
                    >
                        {confirmText}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default ConfirmationModal;
