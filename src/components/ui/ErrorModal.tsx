// src/components/ui/ErrorModal.tsx
'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorModalProps {
    message: string;
    onClose: () => void;
}

const ErrorModal: React.FC<ErrorModalProps> = ({ message, onClose }) => {
    return (
        <div 
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fadeIn"
            style={{ animationDuration: '200ms' }}
        >
            <div className="bg-red-900/80 backdrop-blur-sm border border-red-500 rounded-lg shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
                <header className="p-4 border-b border-red-600 flex-shrink-0 flex items-center gap-3">
                    <AlertTriangle className="h-6 w-6 text-yellow-300" />
                    <h2 className="text-xl font-bold font-garamond text-yellow-200">Erro do Mestre de Jogo</h2>
                </header>
                <main className="p-6 overflow-y-auto">
                    <p className="text-red-100 whitespace-pre-wrap">{message}</p>
                </main>
                <footer className="p-4 flex justify-end items-center gap-4 bg-black/30 rounded-b-lg flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-md font-semibold text-stone-900 bg-yellow-400 hover:bg-yellow-500 transition-colors"
                    >
                        Entendido
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default ErrorModal;
