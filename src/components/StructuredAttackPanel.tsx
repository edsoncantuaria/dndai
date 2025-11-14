import React, { useMemo, useState } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import type { InventoryItem } from '@/types';

const StructuredAttackPanel: React.FC = () => {
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

    if (!weapons.length) return null;

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

    return (
        <form onSubmit={handleSubmit} className="space-y-2 rounded-2xl border border-white/10 bg-black/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Ataque Validado</p>
            <div className="flex flex-col gap-2 sm:flex-row">
                <label className="flex-1 text-sm text-stone-300">
                    Arma
                    <select
                        className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 p-2 text-stone-100"
                        value={selectedWeaponId}
                        onChange={event => setSelectedWeaponId(event.target.value)}
                    >
                        {weapons.map(weapon => (
                            <option key={weapon.index} value={weapon.index}>
                                {weapon.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="w-full max-w-[140px] text-sm text-stone-300">
                    CA alvo
                    <input
                        type="number"
                        min={5}
                        max={30}
                        className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 p-2 text-stone-100"
                        value={targetAc}
                        onChange={event => setTargetAc(event.target.value)}
                        placeholder="opcional"
                    />
                </label>
            </div>
            <button
                type="submit"
                disabled={intentLocked}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-2 text-sm font-semibold text-stone-900 transition hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
            >
                Solicitar rolagem automática
            </button>
            {intentLocked && (
                <p className="text-[11px] text-amber-200/70 text-center">
                    Aguarde terminar o turno atual ou resolver a rolagem pendente.
                </p>
            )}
        </form>
    );
};

export default StructuredAttackPanel;
