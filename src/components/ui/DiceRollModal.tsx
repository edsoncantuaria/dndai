'use client';
import React, { useRef, useEffect, useState } from 'react';
import { PlayerRollRequest } from '@/types';
import { Loader2 } from 'lucide-react';

declare global {
    interface Window {
        DICE: any;
    }
}

interface DiceRollModalProps {
    request: PlayerRollRequest;
    onRoll: (result: number) => void;
}

const DiceRollModal: React.FC<DiceRollModalProps> = ({ request, onRoll }) => {
    const canvasRef = useRef<HTMLDivElement>(null);
    const [result, setResult] = useState<number | null>(null);
    const [isRolling, setIsRolling] = useState(false);
    const boxRef = useRef<any>(null);

    const handleRoll = useCallback(() => {
        if (!boxRef.current || isRolling) return;
        
        setIsRolling(true);
        setResult(null);
        
        const diceToRoll = request.dice.replace(/ /g, '');
        boxRef.current.setDice(diceToRoll);
        
        boxRef.current.start_throw(null, (notation: any) => {
            if (notation.result.length > 0 && !notation.result.some((r: number) => r < 0)) {
                const diceResult = notation.result.reduce((sum: number, val: number) => sum + val, 0);
                const totalResult = diceResult + (request.modifier || 0);
                setResult(totalResult);
            } else {
                console.error("Erro na rolagem de dados 3D, usando fallback.");
                const fallbackResult = Math.floor(Math.random() * 20) + 1 + (request.modifier || 0);
                setResult(fallbackResult);
            }
            setIsRolling(false);
        });
    }, [isRolling, request.dice, request.modifier]);

    useEffect(() => {
        if (typeof window === 'undefined' || !canvasRef.current) return;

        const initializeDiceBox = () => {
            if (window.DICE && canvasRef.current) {
                if (canvasRef.current.hasChildNodes()) {
                    canvasRef.current.innerHTML = '';
                }
                boxRef.current = new window.DICE.dice_box(canvasRef.current);
                // Trigger the roll automatically once initialized
                setTimeout(handleRoll, 100); 
            }
        };

        if (window.DICE) {
            initializeDiceBox();
        } else {
            // If the script hasn't loaded yet, wait for it.
            window.addEventListener('dice-loaded', initializeDiceBox, { once: true });
        }

        return () => {
            window.removeEventListener('dice-loaded', initializeDiceBox);
            if (boxRef.current) {
                boxRef.current.clear();
            }
        };
    }, [handleRoll]);


    const handleConfirm = () => {
        if (result !== null) {
            onRoll(result);
        }
    };

    const modifierString = request.modifier > 0 ? `+${request.modifier}` : request.modifier < 0 ? `${request.modifier}` : '';

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-stone-900 border border-amber-500 rounded-lg shadow-2xl w-full max-w-md flex flex-col">
                <header className="p-4 border-b border-stone-700">
                    <h2 className="text-xl font-bold font-garamond text-amber-300 text-center">{request.reason}</h2>
                    <p className="text-center text-stone-400 text-sm">Role {request.dice}{modifierString}</p>
                    {request.dc && <p className="text-center text-stone-500 text-xs">(CD {request.dc} para ter sucesso)</p>}
                </header>
                <main className="p-6">
                    <div ref={canvasRef} className="h-48 w-full rounded-md bg-black/30 border border-stone-700" id="dice-canvas"></div>
                    
                    {isRolling && (
                        <div className="text-center mt-4">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-400" />
                            <p className="text-stone-300 mt-2">Rolando dados...</p>
                        </div>
                    )}
                    
                    {result !== null && (
                         <div className="text-center mt-4 animate-fadeIn">
                             <p className="text-stone-300">Resultado Total:</p>
                             <p className="text-5xl font-bold text-amber-400 my-2">{result}</p>
                             <p className="text-xs text-stone-500">({request.dice}{modifierString})</p>
                             <button
                                 onClick={handleConfirm}
                                 className="w-full mt-4 bg-green-700 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-md transition-colors text-lg"
                             >
                                 Confirmar e Continuar
                             </button>
                         </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default DiceRollModal;
