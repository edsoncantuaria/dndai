
'use client';
import React, { useState, useCallback, useRef } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { User, Heart, Shield, Loader2, Settings, DoorOpen, LogOut } from 'lucide-react';
import ActionModal from '@/components/ui/ActionModal';
import SettingsModal from './SettingsModal';
import { useAuth } from '@/contexts/AuthContext';


interface HeaderProps {
    returnToMenu: () => void;
}

const Header: React.FC<HeaderProps> = ({ returnToMenu }) => {
    const { character, isLoading } = useGameStateContext();
    const { logout } = useAuth();
    
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showExitModal, setShowExitModal] = useState(false);

    if (!character) {
        return null; // Ou um cabeçalho de placeholder
    }

    const { name, level, characterClass, hp, ac } = character;
    const isInteractionDisabled = isLoading;

    return (
        <>
            <div className="flex-shrink-0 bg-stone-900/50 backdrop-blur-sm p-3 rounded-lg border border-stone-700">
                <div className="flex justify-between items-center gap-3">
                    {/* Character Info */}
                    <div className="flex items-center gap-3 flex-grow">
                        <div className="w-10 h-10 bg-stone-700 rounded-full flex-shrink-0 flex items-center justify-center border-2 border-stone-600">
                            <User className="h-6 w-6 text-stone-400"/>
                        </div>
                        <div className="flex-grow">
                             <h2 className="font-bold text-lg text-stone-100 truncate font-garamond">{name}</h2>
                             <p className="text-sm text-stone-400">
                                {characterClass} de Nível {level}
                            </p>
                        </div>
                    </div>
                    
                     {/* Stats */}
                    <div className="hidden sm:flex items-center gap-4">
                        <div className="text-center flex items-center gap-2">
                            <Heart className="h-5 w-5 text-red-500" />
                            {hp && (
                                <div>
                                    <div className="text-xs text-red-400 font-semibold">VIDA</div>
                                    <div className="font-mono font-bold text-lg text-stone-200">{hp.current} / {hp.max}</div>
                                </div>
                            )}
                        </div>
                        <div className="text-center flex items-center gap-2">
                            <Shield className="h-5 w-5 text-blue-500" />
                            {ac && (
                                <div>
                                    <div className="text-xs text-blue-400 font-semibold">CA</div>
                                    <div className="font-mono font-bold text-lg text-stone-200">{ac.value}</div>
                                </div>
                            )}
                        </div>
                    </div>


                    {/* Desktop Action Buttons */}
                    <div className="hidden md:flex items-center justify-end gap-2">
                        <button
                            onClick={() => setShowSettingsModal(true)}
                            disabled={isInteractionDisabled}
                            className="p-2 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                            title="Configurações"
                        >
                            <Settings className="h-5 w-5 text-amber-300" />
                        </button>
                         <button
                            onClick={() => setShowExitModal(true)}
                            disabled={isInteractionDisabled}
                            className="p-2 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                            title="Sair da Aventura"
                        >
                            <DoorOpen className="h-5 w-5 text-amber-300" />
                        </button>
                    </div>

                    {/* Mobile Action Buttons */}
                    <div className="md:hidden flex items-center gap-1.5">
                        <button
                            onClick={() => setShowSettingsModal(true)}
                            disabled={isInteractionDisabled}
                            className="p-1.5 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                            title="Configurações"
                        >
                            <Settings className="h-4 w-4 text-amber-300" />
                        </button>
                        <button
                            onClick={() => setShowExitModal(true)}
                            disabled={isInteractionDisabled}
                            className="p-1.5 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors disabled:opacity-50"
                            title="Sair da Aventura"
                        >
                            <DoorOpen className="h-4 w-4 text-amber-300" />
                        </button>
                    </div>

                </div>

                {/* Stats for Mobile */}
                <div className="flex sm:hidden items-center gap-4 justify-center mt-3 pt-3 border-t border-stone-700/50">
                    <div className="text-center flex items-center gap-2">
                        <Heart className="h-5 w-5 text-red-500" />
                        {hp && (
                            <div>
                                <div className="text-xs text-red-400 font-semibold">VIDA</div>
                                <div className="font-mono font-bold text-lg text-stone-200">{hp.current} / {hp.max}</div>
                            </div>
                        )}
                    </div>
                    <div className="text-center flex items-center gap-2">
                        <Shield className="h-5 w-5 text-blue-500" />
                        {ac && (
                            <div>
                                <div className="text-xs text-blue-400 font-semibold">CA</div>
                                <div className="font-mono font-bold text-lg text-stone-200">{ac.value}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showExitModal && (
                <ActionModal
                    isOpen={showExitModal}
                    title="Sair da Aventura?"
                    onClose={() => setShowExitModal(false)}
                    actions={[
                        { text: "Cancelar", onClick: () => setShowExitModal(false), variant: 'secondary' },
                        { text: "Voltar ao Menu", onClick: returnToMenu, variant: 'primary' },
                        { text: "Sair da Conta (Logout)", onClick: logout, variant: 'destructive' }
                    ]}
                >
                    <p className="text-stone-300">Seu progresso é salvo automaticamente. Deseja voltar ao menu principal ou fazer logout completo?</p>
                </ActionModal>
            )}

            <SettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
            />
        </>
    );
};

export default Header;
