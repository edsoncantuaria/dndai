'use client';
import React, { useState } from 'react';
import type { Combatant } from '../types';
import { translateCondition } from '../utils/translator';
import { Heart, Shield, User, Bot, Skull, History, PlusSquare, Zap, ArrowDown, ArrowUp, LocateFixed, Handshake, AlertTriangle, Timer, Activity } from 'lucide-react';

type Attitude = NonNullable<Combatant['attitude']>;

const attitudeLabels: Record<Attitude, string> = {
    ally: 'Aliado',
    neutral: 'Neutro',
    hostile: 'Hostil',
};

const attitudeStyles: Record<Attitude, { border: string; icon: string; badge: string; background: string; text: string }> = {
    ally: {
        border: 'border-emerald-500/70',
        icon: 'text-emerald-300',
        badge: 'bg-emerald-900/50 text-emerald-200 border border-emerald-700/60',
        background: 'bg-emerald-900/10',
        text: 'text-emerald-200',
    },
    neutral: {
        border: 'border-slate-600/60',
        icon: 'text-slate-300',
        badge: 'bg-slate-900/40 text-slate-200 border border-slate-700/60',
        background: 'bg-slate-900/20',
        text: 'text-slate-200',
    },
    hostile: {
        border: 'border-red-600/70',
        icon: 'text-red-300',
        badge: 'bg-red-900/40 text-red-200 border border-red-700/60',
        background: 'bg-red-900/20',
        text: 'text-red-200',
    },
};

const statusColorMap: Record<string, string> = {
    'Stunned': 'bg-yellow-600/50 text-yellow-200',
    'Unconscious': 'bg-gray-700/50 text-gray-300',
    'Paralyzed': 'bg-purple-600/50 text-purple-200',
    'Restrained': 'bg-orange-600/50 text-orange-200',
    'Poisoned': 'bg-green-700/50 text-green-300',
    'Frightened': 'bg-indigo-600/50 text-indigo-200',
};

const zoneLabels: Record<NonNullable<Combatant['zone']>, string> = {
    perto: 'Perto',
    medio: 'Médio',
    longe: 'Longe',
    coberto: 'Em Cobertura',
};

const severityTone: Record<NonNullable<Required<NonNullable<Combatant['statusEffects']>>[number]['severity']>, string> = {
    leve: 'text-emerald-300',
    moderado: 'text-amber-300',
    grave: 'text-red-300',
};

const RollHistoryDisplay: React.FC<{ rollHistory?: any[] }> = ({ rollHistory }) => {
    if (!rollHistory || rollHistory.length === 0) {
        return <p className="text-xs italic text-stone-500">Nenhuma rolagem registrada.</p>;
    }
    return (
        <div className="space-y-1">
            {rollHistory.slice(-5).reverse().map((roll, index) => {
                if (!roll || !roll.type) return null;
                 const resultText = roll.success === true ? ' (Sucesso!)' : roll.success === false ? ' (Falha)' : '';
                 const advantageText = roll.advantage ? ' (Vantagem)' : roll.disadvantage ? ' (Desvantagem)' : '';
                 const rollsDisplay = roll.rolls && roll.rolls.length > 0 ? roll.rolls.join(', ') : '';
                return (
                    <div key={index} className="text-xs text-stone-400">
                        <span className="font-semibold">{roll.description || roll.type.toUpperCase()}:</span> {roll.total}{resultText} <span className="text-stone-500">({roll.dice}: {rollsDisplay}{roll.modifier ? `${roll.modifier >= 0 ? '+' : ''}${roll.modifier}` : ''}){advantageText}</span>
                    </div>
                )
            })}
        </div>
    );
};

const CombatantCard: React.FC<{ combatant: Combatant; isCurrentTurn: boolean; isPlayer: boolean }> = ({ combatant, isCurrentTurn, isPlayer }) => {
    const [showHistory, setShowHistory] = useState(false);
    const MAX_AP = 30;
    const MAX_BONUS_AP = 3;

    if (combatant.isDead) {
        return (
            <div className={`flex items-center justify-between p-2 rounded-md bg-stone-900/70 border border-stone-800 opacity-60`}>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-black rounded-full"><Skull className="h-5 w-5 text-stone-500" /></div>
                    <span className="font-semibold text-stone-500 line-through">{combatant.name}</span>
                </div>
                <span className="text-sm font-bold text-red-500">DERROTADO</span>
            </div>
        );
    }

    const attitude: Attitude = combatant.attitude ?? (isPlayer ? 'ally' : 'hostile');
    const attitudeStyle = attitudeStyles[attitude];
    
    const borderColor = isCurrentTurn
        ? 'border-amber-400 shadow-lg shadow-amber-900/50'
        : attitudeStyle.border;
    const bgColor = isCurrentTurn ? 'bg-amber-900/20' : attitudeStyle.background;

    const currentHp = typeof combatant.hp === 'object' ? combatant.hp.current : (typeof combatant.hp === 'number' ? combatant.hp : '?');
    const maxHp = typeof combatant.hp === 'object' ? combatant.hp.max : (combatant.maxHp ?? '?');
    const advantage = combatant.tempModifiers?.advantage;
    const disadvantage = combatant.tempModifiers?.disadvantage;
    const IconComponent = isPlayer ? User : attitude === 'ally' ? Handshake : Bot;
    const iconColor = isCurrentTurn ? 'text-amber-200' : attitudeStyle.icon;
    const statusEffects = combatant.statusEffects ?? [];
    const cooldowns = combatant.cooldowns ?? [];

    return (
        <div className={`p-2.5 rounded-lg border-2 transition-all duration-300 ${borderColor} ${bgColor}`}>
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                     <div className={`p-2 rounded-full ${isCurrentTurn ? 'bg-amber-800' : 'bg-stone-900/80'}`}>
                        <IconComponent className={`h-5 w-5 ${iconColor}`} />
                    </div>
                    <div>
                        <h4 className={`font-bold text-lg ${isCurrentTurn ? 'text-white' : attitudeStyle.text}`}>{combatant.name}</h4>
                        <span className={`inline-flex items-center gap-1 text-[0.65rem] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${attitudeStyle.badge}`}>
                            <span>{attitudeLabels[attitude]}</span>
                            {attitude === 'neutral' && <AlertTriangle className="h-3 w-3" />}
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {(combatant.conditions || []).map((cond, i) => (
                                <span key={i} className={`px-1.5 py-0.5 text-xs font-semibold rounded-full ${statusColorMap[cond] || 'bg-stone-600/50 text-stone-300'}`}>
                                    {translateCondition(cond)}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                     {advantage && <ArrowUp className="h-5 w-5 text-green-400" title="Vantagem no Ataque" />}
                     {disadvantage && <ArrowDown className="h-5 w-5 text-red-400" title="Desvantagem no Ataque" />}
                    <button onClick={() => setShowHistory(!showHistory)} className="text-stone-400 hover:text-white" title="Histórico de Rolagens">
                        <History className="h-4 w-4" />
                    </button>
                    <div className="text-center">
                        <div className="text-xs text-stone-400 flex items-center gap-1"><Shield className="h-3 w-3"/>AC</div>
                        <div className="font-bold text-stone-200">{combatant.ac ?? '?'}</div>
                    </div>
                </div>
            </div>
            
            {showHistory && (
                <div className="mt-2 p-2 bg-stone-950/50 rounded-md">
                    <h6 className="text-xs font-bold text-stone-400 mb-1">ÚLTIMAS ROLAGENS</h6>
                    <RollHistoryDisplay rollHistory={combatant.rollHistory} />
                </div>
            )}
            
            <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                <div className="bg-stone-900/50 p-1.5 rounded-md col-span-2">
                    <div className="text-xs text-red-400 flex items-center justify-center gap-1"><Heart className="h-3 w-3"/> HP</div>
                    <div className="font-mono text-lg font-bold text-red-300">{currentHp} / {maxHp}</div>
                </div>
                 <div className="bg-stone-900/50 p-1.5 rounded-md">
                    <div className="text-xs text-sky-400 flex items-center justify-center gap-1"><Zap className="h-3 w-3"/> AP</div>
                    <div className={`font-mono text-lg font-bold transition-colors ${(combatant.actionPoints ?? 0) > 0 ? 'text-sky-300' : 'text-stone-500'}`}>
                        {(combatant.actionPoints ?? 0)}<span className="text-xs text-sky-500">/{MAX_AP}</span>
                    </div>
                </div>
                 <div className="bg-stone-900/50 p-1.5 rounded-md">
                    <div className="text-xs text-lime-400 flex items-center justify-center gap-1"><PlusSquare className="h-3 w-3"/> Bônus</div>
                    <div className={`font-mono text-lg font-bold transition-colors ${(combatant.bonusActionPoints ?? 0) > 0 ? 'text-lime-300' : 'text-stone-500'}`}>
                        {(combatant.bonusActionPoints ?? 0)}<span className="text-xs text-lime-500">/{MAX_BONUS_AP}</span>
                    </div>
                </div>
            </div>
            {(combatant.zone || combatant.distance !== undefined) && (
                <div className="mt-2 bg-stone-900/50 p-1.5 rounded-md text-center">
                    <div className="text-xs text-purple-300 flex items-center justify-center gap-1">
                        <LocateFixed className="h-3 w-3" /> Posicionamento
                    </div>
                    <div className="flex justify-center gap-2 font-mono text-sm text-purple-200">
                        {combatant.zone && (
                            <span className="uppercase tracking-wide">
                                {zoneLabels[combatant.zone] ?? combatant.zone}
                            </span>
                        )}
                        {combatant.distance !== undefined && (
                            <span>{combatant.distance}m</span>
                        )}
                    </div>
                </div>
            )}

            {statusEffects.length > 0 && (
                <div className="mt-3 bg-stone-900/50 p-2 rounded-md border border-stone-800/70">
                    <div className="text-xs text-amber-300 flex items-center gap-1 font-semibold uppercase tracking-wide">
                        <Activity className="h-3 w-3" /> Efeitos Ativos
                    </div>
                    <div className="mt-1 space-y-1">
                        {statusEffects.map((effect, index) => {
                            const key = effect.id || `${effect.name}-${index}`;
                            const rounds =
                                effect.remainingRounds !== undefined && effect.remainingRounds !== null
                                    ? `${effect.remainingRounds}r`
                                    : 'contínuo';
                            const severityClass = effect.severity ? severityTone[effect.severity] : 'text-amber-200';
                            return (
                                <div key={key} className="bg-stone-950/40 border border-stone-800 rounded-md px-2 py-1 text-xs text-stone-200">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-semibold">{effect.name}</span>
                                        <span className={`font-mono ${severityClass}`}>{rounds}</span>
                                    </div>
                                    {effect.source && (
                                        <p className="text-[0.6rem] text-stone-500 mt-0.5">Fonte: {effect.source}</p>
                                    )}
                                    {effect.description && (
                                        <p className="text-[0.65rem] text-stone-300 mt-0.5 leading-snug">{effect.description}</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {cooldowns.length > 0 && (
                <div className="mt-3 bg-stone-900/50 p-2 rounded-md border border-stone-800/70">
                    <div className="text-xs text-sky-300 flex items-center gap-1 font-semibold uppercase tracking-wide">
                        <Timer className="h-3 w-3" /> Recargas
                    </div>
                    <div className="mt-1 space-y-1">
                        {cooldowns.map((cooldown, index) => {
                            const remaining = Math.max(0, cooldown.remainingRounds ?? 0);
                            const total = Math.max(remaining, cooldown.totalRounds ?? remaining);
                            const progress = total > 0 ? Math.min(100, ((total - remaining) / total) * 100) : 0;
                            const key = cooldown.id || `${cooldown.name}-${index}`;
                            return (
                                <div key={key} className="bg-stone-950/40 border border-stone-800 rounded-md px-2 py-1 text-xs text-stone-200">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-semibold">{cooldown.name}</span>
                                        <span className="font-mono text-amber-300">{remaining}r</span>
                                    </div>
                                    {total > 0 && (
                                        <div className="mt-1 h-1.5 bg-stone-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-amber-500 rounded-full transition-all"
                                                style={{ width: `${Math.max(6, progress)}%` }}
                                            />
                                        </div>
                                    )}
                                    {cooldown.description && (
                                        <p className="text-[0.65rem] text-stone-300 mt-0.5 leading-snug">{cooldown.description}</p>
                                    )}
                                    {cooldown.resource && (
                                        <p className="text-[0.6rem] text-stone-500 mt-0.5 uppercase tracking-wide">{cooldown.resource}</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CombatantCard;
