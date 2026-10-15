'use client';

import { motion } from 'framer-motion';
import { Backpack, Coins, Gem, Hand, Loader2, Package, ShieldCheck, Sword } from 'lucide-react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { DndButton, DndCard } from '@/components/primitives';
import ItemCard from '@/components/ItemCard';
import { cn } from '@/lib/utils';
import { useInventoryData, type DisplayInventoryItem } from './useInventoryData';

function LoadBar({ pct }: { pct: number }) {
  const color =
    pct > 90 ? 'bg-dnd-danger' : pct > 75 ? 'bg-dnd-gold' : 'bg-dnd-success';
  return (
    <div className="h-2 overflow-hidden rounded-full bg-dnd-obsidian">
      <motion.div
        className={cn('h-full rounded-full', color)}
        initial={false}
        animate={{ width: `${Math.min(pct, 100)}%` }}
        transition={{ duration: 0.4 }}
      />
    </div>
  );
}

function CategoryGrid({
  title,
  icon,
  items,
  onEquip,
  onUnequip,
  onUseConsumable,
  actionDisabled,
  equipPendingItemId,
  proficiencies,
}: {
  title: string;
  icon: React.ReactNode;
  items: DisplayInventoryItem[];
  onEquip: (id: string) => void;
  onUnequip: (id: string) => void;
  onUseConsumable: (id: string) => void;
  actionDisabled: boolean;
  equipPendingItemId: string | null;
  proficiencies: string[];
}) {
  if (!items.length) return null;
  return (
    <DndCard padding="sm" hover={false} className="space-y-3 border-dnd-gold/12">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 font-ui text-xs uppercase tracking-wider text-dnd-gold">
          {icon}
          {title}
        </h4>
        <span className="font-ui text-[10px] text-dnd-parchment-muted">{items.length}</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <ItemCard
            key={item._instanceKey || item.id}
            item={item}
            variant="v2"
            onEquip={onEquip}
            onUnequip={onUnequip}
            onUseConsumable={onUseConsumable}
            actionDisabled={actionDisabled}
            equipPending={equipPendingItemId === String(item.id)}
            proficiencies={proficiencies}
          />
        ))}
      </div>
    </DndCard>
  );
}

export function GameplayInventoryPanel() {
  const {
    pendingLootOffer,
    takeLoot,
    isLoading,
    equipItem,
    unequipItem,
    equipPendingItemId,
    useConsumable,
  } = useGameStateContext();
  const data = useInventoryData();

  if (!data) return null;

  const {
    character,
    currentWeight,
    carryingCapacity,
    loadPercentage,
    actionDisabled,
    currency,
    weapons,
    armors,
    magicItems,
    otherItems,
  } = data;

  const allItems = [...weapons, ...armors, ...magicItems, ...otherItems];
  const equippedNow = allItems.filter(item => item.equipped);

  return (
    <div className="space-y-4">
      <DndCard padding="md" hover={false}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-dnd-gold/25 bg-dnd-obsidian text-dnd-gold">
            <Backpack className="h-5 w-5" />
          </span>
          <div>
            <p className="font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">
              Bolsa
            </p>
            <h3 className="font-display text-lg text-dnd-parchment">Equipamento e tesouro</h3>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-md border border-dnd-gold/15 bg-dnd-obsidian/60 p-3">
            <p className="mb-2 flex items-center gap-1 font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">
              <Coins className="h-3 w-3 text-dnd-gold" />
              Moedas
            </p>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              {(['gp', 'sp', 'pp', 'cp', 'ep'] as const).map((type) => (
                <div key={type} className="rounded border border-dnd-gold/10 px-1 py-1">
                  <p className="font-mono text-sm text-dnd-gold">{currency[type]}</p>
                  <p className="font-ui text-[9px] uppercase text-dnd-parchment-muted">{type}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-md border border-dnd-gold/15 bg-dnd-obsidian/60 p-3">
            <p className="font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">
              Carga
            </p>
            <p className="mt-1 font-mono text-sm text-dnd-parchment">
              {currentWeight.toFixed(1)} / {carryingCapacity.toFixed(1)} lb
            </p>
            <div className="mt-2">
              <LoadBar pct={loadPercentage} />
            </div>
            <p className="mt-1 text-right font-ui text-[10px] text-dnd-parchment-muted">
              {loadPercentage.toFixed(0)}%
            </p>
          </div>
        </div>
      </DndCard>

      {equippedNow.length > 0 ? (
        <DndCard padding="sm" hover={false} className="border-dnd-gold/25">
          <h4 className="mb-2 font-ui text-xs uppercase tracking-wider text-dnd-gold">
            Equipado agora
          </h4>
          <ul className="space-y-1 text-sm text-dnd-parchment">
            {equippedNow.map(item => (
              <li key={item._instanceKey || item.id} className="flex items-center justify-between gap-2">
                <span>{item.name}</span>
                <DndButton
                  variant="ghost"
                  size="sm"
                  className="min-h-[36px] shrink-0"
                  disabled={actionDisabled || equipPendingItemId === String(item.id)}
                  onClick={() => unequipItem(String(item.id))}
                >
                  Desequipar
                </DndButton>
              </li>
            ))}
          </ul>
          <p className="mt-2 font-ui text-[10px] text-dnd-parchment-muted">
            CA atual: {character.ac.value}
            {character.ac.source ? ` (${character.ac.source})` : ''}
          </p>
        </DndCard>
      ) : null}

      <CategoryGrid
        title="Armas"
        icon={<Sword className="h-3.5 w-3.5" />}
        items={weapons}
        onEquip={equipItem}
        onUnequip={unequipItem}
        onUseConsumable={useConsumable}
        actionDisabled={actionDisabled}
        equipPendingItemId={equipPendingItemId}
        proficiencies={character.proficiencies || []}
      />
      <CategoryGrid
        title="Armaduras"
        icon={<ShieldCheck className="h-3.5 w-3.5" />}
        items={armors}
        onEquip={equipItem}
        onUnequip={unequipItem}
        onUseConsumable={useConsumable}
        actionDisabled={actionDisabled}
        equipPendingItemId={equipPendingItemId}
        proficiencies={character.proficiencies || []}
      />
      <CategoryGrid
        title="Mágicos"
        icon={<Gem className="h-3.5 w-3.5" />}
        items={magicItems}
        onEquip={equipItem}
        onUnequip={unequipItem}
        onUseConsumable={useConsumable}
        actionDisabled={actionDisabled}
        equipPendingItemId={equipPendingItemId}
        proficiencies={character.proficiencies || []}
      />
      <CategoryGrid
        title="Geral"
        icon={<Package className="h-3.5 w-3.5" />}
        items={otherItems}
        onEquip={equipItem}
        onUnequip={unequipItem}
        onUseConsumable={useConsumable}
        actionDisabled={actionDisabled}
        equipPendingItemId={equipPendingItemId}
        proficiencies={character.proficiencies || []}
      />

      {pendingLootOffer &&
      (pendingLootOffer.items?.length || pendingLootOffer.currency?.gp > 0) ? (
        <DndCard padding="sm" hover={false} className="border-dnd-gold/30">
          <p className="mb-2 flex items-center gap-2 font-ui text-xs uppercase text-dnd-gold">
            <Hand className="h-4 w-4" />
            Saque próximo
          </p>
          <ul className="space-y-1 text-sm text-dnd-parchment">
            {pendingLootOffer.items?.map((item, i) => (
              <li key={item.id || i}>
                {item.name}
                {item.quantity > 1 ? ` ×${item.quantity}` : ''}
              </li>
            ))}
            {pendingLootOffer.currency.gp > 0 ? (
              <li className="text-dnd-gold">{pendingLootOffer.currency.gp} PO</li>
            ) : null}
          </ul>
          <DndButton
            variant="ember"
            className="mt-3 w-full"
            disabled={isLoading}
            onClick={() => takeLoot(true)}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Recolher tudo'}
          </DndButton>
        </DndCard>
      ) : null}
    </div>
  );
}
