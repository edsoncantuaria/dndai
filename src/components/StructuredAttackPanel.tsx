import React, { useMemo, useState } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import type { InventoryItem } from '@/types';
import { DndButton, DndCard } from '@/components/primitives';
import { cn } from '@/lib/utils';

export interface StructuredAttackPanelProps {
    variant?: 'legacy' | 'v2';
}

const StructuredAttackPanel: React.FC<StructuredAttackPanelProps> = ({ variant = 'legacy' }) => {
    const isV2 = variant === 'v2';
    const {
        character,
        isLoading,
        processPlayerAction,
        setPendingStructuredIntent,
        playerRollRequest,
        pendingLootOffer,
        pendingHitDiceRequest,
        combatState,
    } = useGameStateContext();
    const weapons = useMemo(() => {
        if (!character?.inventory?.length) return [];
        return character.inventory.filter((item: InventoryItem) => {
            if (!item) return false;
            if (item.weapon_category || item.weapon_range) return true;
            if (item.damage && item.damage.damage_dice) return true;
            if (item.equipment_category?.name?.toLowerCase().includes('weapon')) return true;
            return false;
        });
    }, [character]);

    const [selectedWeaponId, setSelectedWeaponId] = useState<string>(() => weapons[0]?.index ?? '');
    const [targetAc, setTargetAc] = useState<string>('');

    const isPlayerTurn = useMemo(() => {
        if (!combatState?.isActive || !character) return true;
        const order = combatState.initiativeOrder ?? [];
        if (!order.length) return false;
        const current = order[combatState.turn % order.length];
        const normalizeId = (entry: any): string => {
            if (!entry) return '';
            if (typeof entry === 'string') return entry;
            return entry.id || entry.name || entry.combatantId || '';
        };
        const currentId = normalizeId(current);
        const player = combatState.combatants?.find(c => c.isPlayer);
        return player ? currentId === normalizeId(player) : false;
    }, [combatState, character]);

    if (!weapons.length) return null;

    const intentLocked =
        isLoading ||
        !!playerRollRequest ||
        !!pendingLootOffer ||
        !!pendingHitDiceRequest ||
        (combatState?.isActive && !isPlayerTurn);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (intentLocked) return;
        const weapon = weapons.find(w => w.index === selectedWeaponId) ?? weapons[0];
        if (!weapon) return;

        setPendingStructuredIntent({
            type: 'weapon-attack',
            payload: {
                weaponIndex: weapon.index,
                targetArmorClass: targetAc ? Number(targetAc) : undefined,
            },
        });

        const targetText = targetAc ? ` (contra CA ${targetAc})` : '';
        processPlayerAction(`Eu ataco com ${weapon.name}${targetText}.`);
        setTargetAc('');
    };

    const selectClass = isV2
        ? 'mt-1 w-full min-h-[44px] rounded-md border border-dnd-gold/25 bg-dnd-obsidian-raised/90 px-3 py-2 font-ui text-sm text-dnd-parchment'
        : 'mt-1 w-full rounded-xl border border-white/15 bg-black/40 p-2 text-stone-100';

    const inputClass = isV2
        ? 'mt-1 w-full min-h-[44px] rounded-md border border-dnd-gold/25 bg-dnd-obsidian-raised/90 px-3 py-2 font-ui text-sm text-dnd-parchment'
        : 'mt-1 w-full rounded-xl border border-white/15 bg-black/40 p-2 text-stone-100';

    const formBody = (
        <>
            <p
                className={cn(
                    'text-xs font-semibold uppercase tracking-wide',
                    isV2 ? 'font-ui text-dnd-gold' : 'text-amber-300'
                )}
            >
                Ataque validado
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
                <label className={cn('flex-1 text-sm', isV2 ? 'font-ui text-dnd-parchment' : 'text-stone-300')}>
                    Arma
                    <select
                        className={selectClass}
                        value={selectedWeaponId}
                        onChange={(event) => setSelectedWeaponId(event.target.value)}
                    >
                        {weapons.map((weapon) => (
                            <option key={weapon.index} value={weapon.index}>
                                {weapon.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label
                    className={cn(
                        'w-full max-w-[140px] text-sm',
                        isV2 ? 'font-ui text-dnd-parchment' : 'text-stone-300'
                    )}
                >
                    CA alvo
                    <input
                        type="number"
                        min={5}
                        max={30}
                        className={inputClass}
                        value={targetAc}
                        onChange={(event) => setTargetAc(event.target.value)}
                        placeholder="opcional"
                    />
                </label>
            </div>
            {isV2 ? (
                <DndButton type="submit" variant="ember" className="w-full" disabled={intentLocked}>
                    Solicitar rolagem automática
                </DndButton>
            ) : (
                <button
                    type="submit"
                    disabled={intentLocked}
                    className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-2 text-sm font-semibold text-stone-900 transition hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
                >
                    Solicitar rolagem automática
                </button>
            )}
            {intentLocked && (
                <p
                    className={cn(
                        'text-center text-[11px]',
                        isV2 ? 'text-dnd-parchment-muted' : 'text-amber-200/70'
                    )}
                >
                    Aguarde terminar o turno atual ou resolver a rolagem pendente.
                </p>
            )}
        </>
    );

    if (isV2) {
        return (
            <form onSubmit={handleSubmit} className="space-y-2">
                <DndCard padding="sm" hover={false} className="space-y-2 border-dnd-gold/15">
                    {formBody}
                </DndCard>
            </form>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-2 rounded-2xl border border-white/10 bg-black/30 p-3">
            {formBody}
        </form>
    );
};

export default StructuredAttackPanel;
