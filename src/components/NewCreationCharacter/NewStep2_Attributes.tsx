// src/components/NewCreationCharacter/NewStep2_Attributes.tsx
import React from 'react';
import type { Attributes } from '@/types';
import { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import { getCostForScore } from '@/utils/creationHelpers';
import type { LucideIcon } from 'lucide-react';
import {
    Minus,
    Plus,
    ArrowLeft,
    ArrowRight,
    RefreshCw,
    Star,
    PlusSquare,
    Dice5,
    SlidersHorizontal,
} from 'lucide-react';

interface Props {
    hook: ReturnType<typeof useCharacterCreator>;
    prevStep: () => void;
    nextStep: () => void;
}

type AttributeKey = keyof Attributes;
type AttributeMethod = 'point-buy' | 'roll';

const attributeOrder: AttributeKey[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

const METHOD_OPTIONS: Array<{
    id: AttributeMethod;
    title: string;
    description: string;
    badge: string;
    icon: LucideIcon;
}> = [
    {
        id: 'point-buy',
        title: 'Compra de Pontos',
        description: 'Controle total de onde investir seu potencial heroico.',
        badge: 'Estratégico',
        icon: SlidersHorizontal,
    },
    {
        id: 'roll',
        title: 'Rolar Dados',
        description: 'Deixe o destino moldar suas forças e fraquezas.',
        badge: 'Caótico',
        icon: Dice5,
    },
];

const MethodOptionCard: React.FC<{
    option: (typeof METHOD_OPTIONS)[number];
    isActive: boolean;
    onSelect: () => void;
}> = ({ option, isActive, onSelect }) => {
    const Icon = option.icon;
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`group relative flex flex-col gap-3 rounded-3xl border px-5 py-4 text-left transition-all duration-300 ${
                isActive
                    ? 'border-amber-400/70 bg-gradient-to-br from-amber-500/20 via-transparent to-rose-500/10 shadow-lg shadow-amber-500/20'
                    : 'border-white/5 bg-stone-950/40 hover:border-amber-400/40 hover:bg-stone-900/60'
            }`}
        >
            <div className="flex items-center justify-between">
                <span
                    className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.4em] ${
                        isActive ? 'border-amber-400/70 text-amber-200' : 'border-white/10 text-stone-500'
                    }`}
                >
                    {option.badge}
                </span>
                <div
                    className={`rounded-full border p-2 ${isActive ? 'border-amber-400/70 bg-amber-500/10 text-amber-100' : 'border-white/10 bg-stone-900 text-stone-400'}`}
                >
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            <div>
                <p className="text-lg font-semibold text-stone-100">{option.title}</p>
                <p className="text-sm text-stone-400">{option.description}</p>
            </div>
        </button>
    );
};

const PointBuySection: React.FC<Pick<Props, 'hook'>> = ({ hook }) => {
    const { baseAttributes, points, handleAttributeChange, handleSuggestAttributes, characterClass, details } = hook;

    return (
        <section className="space-y-6 rounded-[32px] border border-white/5 bg-stone-950/70 p-6 shadow-2xl shadow-black/40">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/5 bg-stone-950/50 p-4">
                <div>
                    <p className="text-xs uppercase tracking-[0.5em] text-amber-400/80">Distribuição Tática</p>
                    <h4 className="text-2xl font-semibold text-amber-50">Invista seus pontos de habilidade</h4>
                    <p className="text-sm text-stone-400">
                        Ajuste cada atributo até que os pontos zerem para liberar o próximo passo.
                    </p>
                </div>
                <div className="flex flex-col items-end gap-2 text-right">
                    <button
                        type="button"
                        onClick={handleSuggestAttributes}
                        disabled={!characterClass}
                        title={!characterClass ? 'Selecione uma classe para habilitar sugestões.' : 'Sugerir atributos para a classe atual.'}
                        className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 transition disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Star className="h-4 w-4" />
                        Sugerir automaticamente
                    </button>
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.4em] text-stone-500">Pontos restantes</p>
                        <p className="text-3xl font-semibold text-amber-300">{points}</p>
                        <p className="text-xs text-stone-500">
                            {characterClass
                                ? `Otimizado para ${details.classDetails?.name || 'classe atual'}`
                                : 'Selecione uma classe para sugestões inteligentes.'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {attributeOrder.map(attr => {
                    const currentScore = baseAttributes[attr];
                    const costToIncrease = getCostForScore(currentScore + 1);
                    const isMaxed = currentScore >= 15 || costToIncrease > points;
                    return (
                        <div
                            key={attr}
                            className="rounded-3xl border border-white/5 bg-gradient-to-br from-stone-900/80 to-stone-950/60 p-4"
                        >
                            <div className="flex items-center justify-between">
                                <p className="text-sm uppercase tracking-[0.4em] text-stone-500">{attr.substring(0, 3).toUpperCase()}</p>
                                <span className="text-xs text-stone-400">
                                    {costToIncrease > 2 ? 'Limite atingido' : `Custo +${costToIncrease}`}
                                </span>
                            </div>
                            <p className="mt-1 text-2xl font-semibold text-amber-50">
                                {attr.charAt(0).toUpperCase() + attr.slice(1)}
                            </p>
                            <div className="mt-4 flex items-center justify-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => handleAttributeChange(attr, -1)}
                                    disabled={currentScore <= 8}
                                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-stone-900 text-stone-200 transition hover:border-amber-400 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <Minus className="h-4 w-4" />
                                </button>
                                <p className="w-16 text-center text-4xl font-bold text-amber-300">{currentScore}</p>
                                <button
                                    type="button"
                                    onClick={() => handleAttributeChange(attr, 1)}
                                    disabled={isMaxed}
                                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-stone-900 text-stone-200 transition hover:border-emerald-400 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

const RollDiceSection: React.FC<Pick<Props, 'hook'>> = ({ hook }) => {
    const { baseAttributes, handleRollAttributes } = hook;

    return (
        <section className="space-y-6 rounded-[32px] border border-white/5 bg-stone-950/70 p-6 shadow-2xl shadow-black/40">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/5 bg-stone-950/50 p-4">
                <div>
                    <p className="text-xs uppercase tracking-[0.5em] text-amber-400/80">Destino Aleatório</p>
                    <h4 className="text-2xl font-semibold text-amber-50">Role 4d6 e descarte o menor dado</h4>
                    <p className="text-sm text-stone-400">Os resultados são aplicados automaticamente aos atributos.</p>
                </div>
                <button
                    type="button"
                    onClick={handleRollAttributes}
                    className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:bg-amber-500/20"
                >
                    <RefreshCw className="h-4 w-4" />
                    Rolar novamente
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {attributeOrder.map(attr => (
                    <div
                        key={attr}
                        className="rounded-3xl border border-dashed border-white/10 bg-stone-950/50 p-4 text-center"
                    >
                        <p className="text-sm uppercase tracking-[0.4em] text-stone-500">{attr.substring(0, 3).toUpperCase()}</p>
                        <p className="mt-2 text-4xl font-bold text-amber-300">{baseAttributes[attr]}</p>
                        <p className="text-xs text-stone-400">Valor atual após a última rolagem</p>
                    </div>
                ))}
            </div>
        </section>
    );
};

const VariantHumanSection: React.FC<Pick<Props, 'hook'>> = ({ hook }) => {
    const { variantHumanBonusSelections, setField } = hook;
    const maxSelections = 2;

    return (
        <section className="rounded-[32px] border border-emerald-500/30 bg-emerald-500/5 p-6 shadow-2xl shadow-black/30">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-[0.5em] text-emerald-300/80">Humano Variante</p>
                    <h4 className="text-2xl font-semibold text-emerald-50">Selecione dois atributos para +1</h4>
                    <p className="text-sm text-emerald-100/80">
                        {variantHumanBonusSelections.length}/{maxSelections} escolhidos
                    </p>
                </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                {attributeOrder.map(attr => {
                    const isSelected = variantHumanBonusSelections.includes(attr);
                    const isDisabled = !isSelected && variantHumanBonusSelections.length >= maxSelections;
                    return (
                        <button
                            key={attr}
                            type="button"
                            onClick={() =>
                                setField('variantHumanBonusSelections', (prev: AttributeKey[]) => {
                                    if (isSelected) return prev.filter(a => a !== attr);
                                    if (prev.length < maxSelections) return [...prev, attr];
                                    return prev;
                                })
                            }
                            disabled={isDisabled}
                            className={`flex flex-col items-center justify-center rounded-2xl border px-4 py-3 text-center text-sm font-semibold transition ${
                                isSelected
                                    ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-50'
                                    : 'border-white/10 bg-stone-950/40 text-stone-200 hover:border-emerald-400/40 hover:text-emerald-100'
                            } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                            <PlusSquare className="mb-1 h-5 w-5" />
                            {attr.substring(0, 3).toUpperCase()}
                        </button>
                    );
                })}
            </div>
        </section>
    );
};

const FinalAttributesPanel: React.FC<Pick<Props, 'hook'>> = ({ hook }) => {
    const { racialBonuses, finalAttributes, baseAttributes } = hook;

    return (
        <section className="rounded-[32px] border border-white/5 bg-stone-950/70 p-6 shadow-2xl shadow-black/40">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-[0.5em] text-amber-400/80">Prévia Final</p>
                    <h4 className="text-2xl font-semibold text-amber-50">Atributos com bônus raciais</h4>
                </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                {attributeOrder.map(attr => {
                    const base = baseAttributes[attr];
                    const racial = racialBonuses[attr] || 0;
                    const total = finalAttributes[attr];
                    const modifier = Math.floor((total - 10) / 2);
                    return (
                        <div key={attr} className="rounded-2xl border border-white/5 bg-stone-950/60 p-4 text-center">
                            <p className="text-sm uppercase tracking-[0.4em] text-stone-500">{attr.substring(0, 3).toUpperCase()}</p>
                            <p className="mt-1 text-3xl font-bold text-amber-200">{total}</p>
                            <p className="text-xs text-stone-400">
                                {base} {racial > 0 ? `+ ${racial}` : ''}
                            </p>
                            <p className="mt-1 text-lg font-semibold text-emerald-300">{modifier >= 0 ? `+${modifier}` : modifier}</p>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

const NewStep2_Attributes: React.FC<Props> = ({ hook, prevStep, nextStep }) => {
    const {
        attributeMethod,
        setField,
        points,
        isVariantHuman,
        variantHumanBonusSelections,
    } = hook;

    const canProceed =
        (attributeMethod === 'roll' || (attributeMethod === 'point-buy' && points === 0)) &&
        (!isVariantHuman || variantHumanBonusSelections.length === 2);

    return (
        <div className="space-y-8 animate-fadeIn">
            <section className="rounded-[32px] border border-white/5 bg-stone-950/70 p-6 shadow-2xl shadow-black/40">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.5em] text-amber-400/80">Método de Distribuição</p>
                        <h3 className="text-2xl font-semibold text-amber-50">Escolha como definir seus atributos</h3>
                        {!attributeMethod && (
                            <p className="text-sm text-stone-400">
                                Selecione um método para desbloquear as ferramentas de alocação.
                            </p>
                        )}
                    </div>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {METHOD_OPTIONS.map(option => (
                        <MethodOptionCard
                            key={option.id}
                            option={option}
                            isActive={attributeMethod === option.id}
                            onSelect={() => setField('attributeMethod', option.id)}
                        />
                    ))}
                </div>
            </section>

            {attributeMethod === 'point-buy' && <PointBuySection hook={hook} />}
            {attributeMethod === 'roll' && <RollDiceSection hook={hook} />}

            {isVariantHuman && attributeMethod && <VariantHumanSection hook={hook} />}

            {attributeMethod && <FinalAttributesPanel hook={hook} />}

            <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                    type="button"
                    onClick={prevStep}
                    className="flex items-center justify-center gap-2 rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-stone-100 transition hover:border-white/40 hover:bg-white/5"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para Raça & Classe
                </button>
                <button
                    type="button"
                    onClick={nextStep}
                    disabled={!canProceed}
                    className="flex items-center justify-center gap-3 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/80 to-rose-500/70 px-6 py-3 text-base font-semibold text-stone-950 shadow-lg shadow-amber-500/30 transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {canProceed ? 'Prosseguir para Antecedente' : 'Conclua os ajustes'}
                    <ArrowRight className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
};

export default NewStep2_Attributes;
