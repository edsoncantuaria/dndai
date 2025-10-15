'use client';
import React, { useState } from 'react';
import { ArrowRight, Dice5 } from 'lucide-react';
import { translateApiString } from '@/utils/translator';

interface SkillCheckModalProps {
    skillName: string;
    onConfirm: (description: string) => void;
    onClose: () => void;
}

const SkillCheckModal: React.FC<SkillCheckModalProps> = ({ skillName, onConfirm, onClose }) => {
    const [description, setDescription] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(description);
    };

    return (
        <div 
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fadeIn"
            style={{ animationDuration: '200ms' }}
            onClick={onClose}
        >
            <div 
                className="bg-stone-900 border border-amber-500 rounded-lg shadow-2xl w-full max-w-md flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="p-4 border-b border-stone-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold font-garamond text-amber-300">Usar Perícia: {translateApiString(`Skill: ${skillName}`)}</h2>
                    <button onClick={onClose} className="text-stone-400 hover:text-white text-2xl">&times;</button>
                </header>
                <form onSubmit={handleSubmit}>
                    <main className="p-6 space-y-4">
                        <label htmlFor="skill-description" className="block text-stone-300">
                            Como você quer usar esta perícia? (Opcional)
                        </label>
                        <textarea
                            id="skill-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full bg-stone-800 border border-stone-600 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            placeholder={`Ex: "para intimidar o guarda" ou "para procurar por armadilhas"`}
                        />
                         <p className="text-xs text-stone-500">Deixe em branco para uma tentativa geral ou descreva sua intenção.</p>
                    </main>
                    <footer className="p-4 flex justify-end items-center gap-4 bg-stone-950/50 rounded-b-lg">
                         <button type="button" onClick={onClose} className="px-6 py-2 rounded-md font-semibold text-stone-200 bg-stone-700 hover:bg-stone-600 transition-colors">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 rounded-md font-semibold text-stone-900 bg-amber-600 hover:bg-amber-700 transition-colors flex items-center gap-2"
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

    
