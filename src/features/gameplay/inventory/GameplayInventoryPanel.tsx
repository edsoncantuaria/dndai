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
  onToggleEquip,
  onUseConsumable,
  actionDisabled,
  proficiencies,
}: {
  title: string;
  icon: React.ReactNode;
  items: DisplayInventoryItem[];
  onToggleEquip: (id: string) => void;
  onUseConsumable: (id: string) => void;
  actionDisabled: boolean;
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
            onToggleEquip={onToggleEquip}
            onUseConsumable={onUseConsumable}
            actionDisabled={actionDisabled}
            proficiencies={proficiencies}
          />
        ))}
      </div>
    </DndCard>
  );
}

export function GameplayInventoryPanel() {
  const { pendingLootOffer, takeLoot, isLoading, toggleEquipped, useConsumable } =
    useGameStateContext();
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

  return (
    <div className="space-y-4">
      <DndCard padding="md" hover={false}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-dnd-gold/25 bg-dnd-obsidian text-dnd-gold">
            <Backpack className="h-5 w-5" />
          </span>
          <div>
            <p className="font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">
              Inventário
            </p>
            <h3 className="font-display text-lg text-dnd-parchment">Bolsa do aventureiro</h3>
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

      <CategoryGrid
        title="Armas"
        icon={<Sword className="h-3.5 w-3.5" />}
        items={weapons}
        onToggleEquip={toggleEquipped}
        onUseConsumable={useConsumable}
        actionDisabled={actionDisabled}
        proficiencies={character.proficiencies || []}
      />
      <CategoryGrid
        title="Armaduras"
        icon={<ShieldCheck className="h-3.5 w-3.5" />}
        items={armors}
        onToggleEquip={toggleEquipped}
        onUseConsumable={useConsumable}
        actionDisabled={actionDisabled}
        proficiencies={character.proficiencies || []}
      />
      <CategoryGrid
        title="Mágicos"
        icon={<Gem className="h-3.5 w-3.5" />}
        items={magicItems}
        onToggleEquip={toggleEquipped}
        onUseConsumable={useConsumable}
        actionDisabled={actionDisabled}
        proficiencies={character.proficiencies || []}
      />
      <CategoryGrid
        title="Geral"
        icon={<Package className="h-3.5 w-3.5" />}
        items={otherItems}
        onToggleEquip={toggleEquipped}
        onUseConsumable={useConsumable}
        actionDisabled={actionDisabled}
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
