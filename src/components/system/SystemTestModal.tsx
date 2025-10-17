// src/components/system/SystemTestModal.tsx
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import type { PlayerRollRequest, Character } from '../../types';
import DiceRollModal from '../DiceRollModal';
import { useGameStateContext } from '@/contexts/GameStateContext';
import * as characterUtils from '../../utils/characterUtils';
import { translateApiString } from '@/utils/translator';
import { AVAILABLE_MODELS, useSettingsContext } from '@/contexts/SettingsContext';
import * as GameService from '@/services/gameService';
import * as AiService from '@/services/aiService'; // Importar o serviço de IA do frontend
import { Dices, BrainCircuit, Bot, Send, Store, Swords, Loader2, Image as ImageIcon } from 'lucide-react';
import ActionModal from '../ui/ActionModal';
import Image from 'next/image';


const DICE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd100', 'd12', 'd20'];

const DiceTestSection: React.FC = () => {
    const [numDice, setNumDice] = useState(1);
    const [dieType, setDieType] = useState('d20');
    const [modifier, setModifier] = useState(0);
    const [advantage, setAdvantage] = useState(false);
    const [disadvantage, setDisadvantage] = useState(false);
    const [rollRequest, setRollRequest] = useState<PlayerRollRequest | null>(null);

    const handlePrepareRoll = () => {
        const notation = `${numDice}${dieType}`;
        const newRollRequest: PlayerRollRequest = {
            reason: 'Teste de Rolagem 3D (Isolado)',
            dice: notation,
            modifier: modifier,
            rollType: 'check',
            advantage: advantage && numDice === 1 && dieType === 'd20',
            disadvantage: disadvantage && numDice === 1 && dieType === 'd20',
        };
        setRollRequest(newRollRequest);
    };

    const handleRollComplete = (result: { rawRoll: number; rolls: number[] }) => {
        console.log("Resultado final do teste de dados:", result);
        setRollRequest(null);
    };

    return (
        <div className="p-4 border border-stone-700 rounded-lg">
            <h3 className="font-semibold text-stone-300 mb-3">Teste de Rolagem 3D (Isolado)</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
                 <div>
                    <label className="block text-sm font-medium text-stone-300 mb-1">Qtd.</label>
                    <input type="number" value={numDice} onChange={e => setNumDice(parseInt(e.target.value))} min="1" max="10" className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-stone-300 mb-1">Tipo</label>
                    <select value={dieType} onChange={e => setDieType(e.target.value)} className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200">
                        {DICE_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
            </div>
            <div className="mb-4">
                <label className="block text-sm font-medium text-stone-300 mb-1">Modificador</label>
                <input type="number" value={modifier} onChange={e => setModifier(parseInt(e.target.value) || 0)} className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200"/>
            </div>
            <div className="flex justify-around text-stone-300 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={advantage} onChange={e => { setAdvantage(e.target.checked); if (e.target.checked) setDisadvantage(false); }} disabled={numDice > 1 || dieType !== 'd20'} className="form-checkbox text-amber-500 bg-stone-700 border-stone-600 rounded disabled:opacity-50"/>
                    Vantagem
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={disadvantage} onChange={e => { setDisadvantage(e.target.checked); if (e.target.checked) setAdvantage(false); }} disabled={numDice > 1 || dieType !== 'd20'} className="form-checkbox text-red-500 bg-stone-700 border-stone-600 rounded disabled:opacity-50"/>
                    Desvantagem
                </label>
            </div>
            <button
                onClick={handlePrepareRoll}
                className="w-full px-4 py-2 rounded-md font-semibold text-stone-900 bg-amber-600 hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
            >
                Rolar o Dado <Dices className="h-4 w-4"/>
            </button>
            {rollRequest && (
                <DiceRollModal
                    request={rollRequest}
                    onRoll={handleRollComplete as any}
                    onClose={() => setRollRequest(null)}
                    show={!!rollRequest}
                />
            )}
        </div>
    );
};

const SystemInteractionSection: React.FC<{ onClose: () => void; characters: Character[] }> = ({ onClose, characters }) => {
    const { 
        triggerTestShop,
        triggerTestCombat,
        handleSkillCheckSubmit,
        processPlayerAction,
        setCharacter, 
    } = useGameStateContext();

    const { model: currentModel, imageModel, getApiKey } = useSettingsContext();
    const [tempModel, setTempModel] = useState(currentModel);
    
    const [selectedSkill, setSelectedSkill] = useState<string>('Acrobatics');
    const [customAction, setCustomAction] = useState<string>('');
    const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');

    // State for Image Generation Test
    const [imagePrompt, setImagePrompt] = useState<string>('Um dragão dourado dormindo em uma montanha de moedas de ouro');
    const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
    const [showImageModal, setShowImageModal] = useState<boolean>(false);

    const handleCharacterSelect = useCallback(async (id: string) => {
        setSelectedCharacterId(id);
        if (id) {
            const charData = await GameService.getCharacterById(Number(id));
            if(charData) {
                const fullChar = await characterUtils.buildFrontendCharacter(charData as any);
                setCharacter(fullChar);
            }
        } else {
            setCharacter(null); // Clear character if "nenhum" is selected
        }
    }, [setCharacter]);


    const handleTestSkill = () => {
        handleSkillCheckSubmit(`para testar a perícia ${selectedSkill}`);
        onClose();
    };

    const handleTestAction = () => {
        if (!customAction.trim()) return;
        processPlayerAction(customAction, -1, tempModel);
        onClose();
    };
    
    const handleGenerateImage = async () => {
        if (!imagePrompt.trim()) return;
        setIsGeneratingImage(true);
        setGeneratedImageUrl(null);
        try {
            const apiKey = getApiKey();
            if(!apiKey) throw new Error("Chave de API não encontrada");
            const result = await AiService.generateImage({
                prompt: imagePrompt,
                model: imageModel,
                apiKey
            });
            if (result?.imageUrl) {
                setGeneratedImageUrl(result.imageUrl);
                setShowImageModal(true);
            } else {
                throw new Error("A IA não conseguiu gerar a imagem.");
            }
        } catch (error: any) {
            console.error("Image generation test failed:", error);
            // You might want to show a toast here
        } finally {
            setIsGeneratingImage(false);
        }
    };


    return (
        <div className="p-4 border border-stone-700 rounded-lg space-y-4">
            <h3 className="font-semibold text-stone-300 mb-3 flex items-center gap-2"><Bot className="h-5 w-5"/>Testar Interações da IA</h3>
            
            <div className="space-y-2">
                <label htmlFor="ia-model-test-select" className="block text-sm font-medium text-stone-400">1. Selecione o Modelo de IA</label>
                <select
                    id="ia-model-test-select"
                    value={tempModel}
                    onChange={(e) => setTempModel(e.target.value)}
                    className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200"
                >
                    {AVAILABLE_MODELS.map(modelName => (
                        <option key={modelName} value={modelName}>{modelName}</option>
                    ))}
                </select>
            </div>
            
            <div className="space-y-2">
                <label htmlFor="character-test-select" className="block text-sm font-medium text-stone-400">2. Selecione um Personagem para Contexto (Opcional)</label>
                <select
                    id="character-test-select"
                    value={selectedCharacterId}
                    onChange={(e) => handleCharacterSelect(e.target.value)}
                    className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200"
                >
                    <option value="">Nenhum (usar herói padrão)</option>
                    {characters.map(char => (
                        <option key={char.id} value={char.id.toString()}>{char.name} - {char.characterClass} Nv {char.level}</option>
                    ))}
                </select>
            </div>

            <div className="space-y-2">
                <label htmlFor="skill-test-select" className="block text-sm font-medium text-stone-400">3. Testar Fluxo de Perícia</label>
                <div className="flex gap-2">
                    <select
                        id="skill-test-select"
                        value={selectedSkill}
                        onChange={(e) => setSelectedSkill(e.target.value)}
                        className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200"
                    >
                        {characterUtils.ALL_SKILLS.map(skill => (
                            <option key={skill} value={skill}>{translateApiString(skill)}</option>
                        ))}
                    </select>
                    <button onClick={handleTestSkill} className="px-3 py-2 rounded-md font-semibold text-white bg-cyan-700 hover:bg-cyan-600 transition-colors flex items-center justify-center gap-2">
                        <BrainCircuit className="h-4 w-4"/> Testar
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                <label htmlFor="action-test-input" className="block text-sm font-medium text-stone-400">4. Testar Ação Direta</label>
                <div className="flex gap-2">
                    <input
                        id="action-test-input"
                        type="text"
                        value={customAction}
                        onChange={(e) => setCustomAction(e.target.value)}
                        placeholder="Ex: Eu chuto a porta"
                        className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200"
                    />
                    <button onClick={handleTestAction} disabled={!customAction.trim()} className="px-3 py-2 rounded-md font-semibold text-stone-900 bg-amber-500 hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                        <Send className="h-4 w-4"/> Enviar
                    </button>
                </div>
            </div>
             <div className="space-y-2">
                <label htmlFor="image-test-input" className="block text-sm font-medium text-stone-400">5. Testar Geração de Imagem</label>
                <div className="flex gap-2">
                    <input
                        id="image-test-input"
                        type="text"
                        value={imagePrompt}
                        onChange={(e) => setImagePrompt(e.target.value)}
                        placeholder="Ex: Um dragão dourado..."
                        className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200"
                    />
                    <button onClick={handleGenerateImage} disabled={!imagePrompt.trim() || isGeneratingImage} className="px-3 py-2 rounded-md font-semibold text-white bg-purple-700 hover:bg-purple-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                        {isGeneratingImage ? <Loader2 className="h-4 w-4 animate-spin"/> : <ImageIcon className="h-4 w-4"/>} Gerar
                    </button>
                </div>
            </div>
            <div className="space-y-2">
                <label className="block text-sm font-medium text-stone-400">6. Simular Cenários de UI</label>
                <div className="grid grid-cols-2 gap-2">
                     <button onClick={() => { triggerTestShop(); onClose(); }} className="px-3 py-2 rounded-md font-semibold text-white bg-indigo-700 hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2">
                        <Store className="h-4 w-4"/> Testar UI da Loja
                    </button>
                     <button onClick={() => { triggerTestCombat(); onClose(); }} className="px-3 py-2 rounded-md font-semibold text-white bg-red-800 hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
                        <Swords className="h-4 w-4"/> Testar UI de Combate
                    </button>
                </div>
            </div>
            {showImageModal && generatedImageUrl && (
                <ActionModal
                    isOpen={showImageModal}
                    title="Imagem Gerada"
                    onClose={() => setShowImageModal(false)}
                    actions={[{ text: "Fechar", onClick: () => setShowImageModal(false), variant: 'primary'}]}
                >
                    <Image src={generatedImageUrl} alt="Imagem de teste gerada pela IA" width={1024} height={576} className="w-full h-auto rounded-md" />
                </ActionModal>
            )}
        </div>
    );
};


const SystemTestModal: React.FC<{ isOpen: boolean; onClose: () => void; characters: Character[] }> = ({ isOpen, onClose, characters }) => {

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fadeIn"
            style={{ animationDuration: '200ms' }}
            onClick={onClose}
        >
            <div 
                className="bg-stone-900 border border-amber-600/50 rounded-lg shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="p-4 border-b border-stone-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold font-garamond text-amber-300">Painel de Testes do Sistema</h2>
                    <button onClick={onClose} className="text-stone-400 hover:text-white text-2xl">&times;</button>
                </header>
                <main className="p-6 space-y-4 overflow-y-auto">
                    <DiceTestSection />
                    <SystemInteractionSection onClose={onClose} characters={characters} />
                </main>
            </div>
        </div>
    );
};

export default SystemTestModal;
