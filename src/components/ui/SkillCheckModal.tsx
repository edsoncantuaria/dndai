'use client';
import React, { useState } from 'react';
import { ArrowRight, Dice5 } from 'lucide-react';

interface SkillCheckModalProps {
    skillName: string;
    promptHint?: string;
    onConfirm: (description: string) => void;
    onClose: () => void;
}

const SkillCheckModal: React.FC<SkillCheckModalProps> = ({ skillName, promptHint, onConfirm, onClose }) => {
    const [description, setDescription] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(description);
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/80 backdrop-blur-sm animate-fadeIn"
            onClick={onClose}
        >
            <div 
                className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#080b12]/95 shadow-[0_40px_80px_rgba(0,0,0,0.65)] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="p-6 border-b border-white/10 flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.5em] text-amber-300">Teste de perícia</p>
                        <h2 className="text-2xl font-serif text-white mt-1">{skillName}</h2>
                    </div>
                    <button onClick={onClose} className="rounded-full border border-white/20 p-2 text-stone-300 hover:text-white transition">
                        &times;
                    </button>
                </header>
                <form onSubmit={handleSubmit}>
                    <main className="p-6 space-y-4 text-sm text-stone-200">
                        {promptHint && (
                            <p className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
                                Sugestão do Mestre: {promptHint}
                            </p>
                        )}
                        <label htmlFor="skill-description" className="text-xs uppercase tracking-[0.35em] text-stone-400">
                            Como você quer usar esta perícia?
                        </label>
                        <textarea
                            id="skill-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            className="w-full rounded-2xl border border-white/15 bg-black/40 p-3 text-stone-100 focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-stone-500"
                            placeholder={`Ex: "para intimidar o guarda" ou "para procurar por armadilhas"`}
                        />
                        <p className="text-xs text-stone-500">Deixe em branco para uma tentativa geral.</p>
                    </main>
                    <footer className="p-6 border-t border-white/10 bg-white/5 flex flex-wrap justify-end gap-3">
                         <button type="button" onClick={onClose} className="px-5 py-2 rounded-full border border-white/20 text-stone-200 hover:bg-white/10 transition">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 rounded-full font-semibold text-stone-900 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition flex items-center gap-2"
                        >
                            Confirmar
                            <Dice5 className="h-4 w-4"/>
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

export default SkillCheckModal;
