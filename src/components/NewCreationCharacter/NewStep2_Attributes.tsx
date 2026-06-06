// src/components/NewCreationCharacter/NewStep2_Attributes.tsx
import React from 'react';
import type { Attributes } from '@/types';
import { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import { getCostForScore } from '@/utils/creationHelpers';
import {
    Minus,
    Plus,
    ArrowLeft,
    ArrowRight,
    RefreshCw,
    Star,
    PlusSquare,
} from 'lucide-react';
import { WizardSection, WizardPickCard } from '@/features/character-create/wizardUi';
import { areAttributesComplete } from '@/features/character-create/stepCompleteness';

interface Props {
    hook: ReturnType<typeof useCharacterCreator>;
    prevStep: () => void;
    nextStep: () => void;
    hideNav?: boolean;
}

type AttributeKey = keyof Attributes;
type AttributeMethod = 'point-buy' | 'roll';

const attributeOrder: AttributeKey[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

const METHOD_OPTIONS: Array<{
    id: AttributeMethod;
    title: string;
    description: string;
}> = [
    {
        id: 'point-buy',
        title: 'Compra de Pontos',
        description: 'Controle total de onde investir seu potencial heroico.',
    },
    {
        id: 'roll',
        title: 'Rolar Dados',
        description: 'Deixe o destino moldar suas forças e fraquezas.',
    },
];

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
    const { baseAttributes, handleRollAttributes, isRollingAttributes, rollError, rollSessionId } = hook;
    const hasRolled = Object.values(baseAttributes).some((value) => value !== 8);

    return (
        <section className="space-y-6 rounded-[32px] border border-white/5 bg-stone-950/70 p-6 shadow-2xl shadow-black/40">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/5 bg-stone-950/50 p-4">
                <div>
                    <p className="text-xs uppercase tracking-[0.5em] text-amber-400/80">Destino Aleatório</p>
                    <h4 className="text-2xl font-semibold text-amber-50">Role 4d6 e descarte o menor dado</h4>
                    <p className="text-sm text-stone-400">
                        A rolagem é feita no servidor — os resultados não podem ser alterados no navegador.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void handleRollAttributes()}
                    disabled={isRollingAttributes}
                    className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <RefreshCw className={`h-4 w-4 ${isRollingAttributes ? 'animate-spin' : ''}`} />
                    {isRollingAttributes ? 'Rolando…' : hasRolled ? 'Rolar novamente' : 'Rolar atributos'}
                </button>
            </div>

            {rollError ? (
                <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">
                    {rollError}
                </p>
            ) : null}

            {hasRolled && rollSessionId ? (
                <p className="font-ui text-xs text-stone-500">Rolagem registrada — selada no servidor.</p>
            ) : null}

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

const NewStep2_Attributes: React.FC<Props> = ({ hook, prevStep, nextStep, hideNav }) => {
    const {
        attributeMethod,
        setField,
        isVariantHuman,
    } = hook;

    const canProceed = areAttributesComplete(hook);
    const methodChosen = attributeMethod !== null;

    return (
        <div className="space-y-6 animate-fadeIn">
            <WizardSection
                eyebrow="Passo 1"
                title="Como definir os atributos?"
                description="Escolha um método. Só depois disso você distribui ou rola os valores."
            >
                <div className="grid gap-2 sm:grid-cols-2">
                    {METHOD_OPTIONS.map((option) => (
                        <WizardPickCard
                            key={option.id}
                            title={option.title}
                            subtitle={option.description}
                            selected={attributeMethod === option.id}
                            onClick={() => setField('attributeMethod', option.id)}
                        />
                    ))}
                </div>
            </WizardSection>

            {!methodChosen ? (
                <p className="rounded-lg border border-dnd-gold/15 bg-dnd-obsidian/60 px-4 py-3 font-ui text-sm text-dnd-parchment-muted">
                    Selecione <strong className="text-dnd-parchment">compra de pontos</strong> ou{' '}
                    <strong className="text-dnd-parchment">rolar dados</strong> para continuar.
                </p>
            ) : (
                <>
                    <WizardSection
                        eyebrow="Passo 2"
                        title={
                            attributeMethod === 'point-buy'
                                ? 'Distribua seus pontos'
                                : 'Role seus atributos'
                        }
                        description={
                            attributeMethod === 'point-buy'
                                ? 'Gaste os 27 pontos até zerar o saldo.'
                                : 'Use 4d6 descartando o menor dado em cada atributo.'
                        }
                    >
                        {attributeMethod === 'point-buy' ? <PointBuySection hook={hook} /> : null}
                        {attributeMethod === 'roll' ? <RollDiceSection hook={hook} /> : null}
                    </WizardSection>

                    {isVariantHuman ? <VariantHumanSection hook={hook} /> : null}

                    <FinalAttributesPanel hook={hook} />
                </>
            )}

            {!hideNav ? (
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
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
                    {canProceed ? 'Prosseguir para Antecedente' : methodChosen ? 'Conclua os ajustes' : 'Escolha o método'}
                    <ArrowRight className="h-5 w-5" />
                </button>
            </div>
            ) : null}
        </div>
    );
};

export default NewStep2_Attributes;
