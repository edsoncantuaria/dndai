// src/components/ShopModal.tsx
'use client';

import React, { useState } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import { ShopItem } from '../types';
import { translateEquipment } from '../utils/translator';
import { canAfford } from '@/utils/currency';
import { useEventFeedback } from '@/hooks/useEventFeedback';
import { Coins, Wallet } from 'lucide-react';
import { DndButton, DndCard } from '@/components/primitives';
import { DndGameModalShell } from '@/features/gameplay/modals/DndGameModalShell';
import { cn } from '@/lib/utils';

const ShopModal: React.FC = () => {
  const { shopState, character, buyItem, sellItem, closeShop, isLoading } = useGameStateContext();
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const { playCue } = useEventFeedback();

  if (!shopState?.isOpen || !character) {
    return null;
  }

  const handleClose = () => closeShop();
  const isInteractionDisabled = isLoading || shopState.isHaggling;

  const renderBuyRows = () => (
    <div className="space-y-3">
      {shopState.inventory.length === 0 ? (
        <p className="py-6 text-center font-ui text-sm italic text-dnd-parchment-muted">
          O mercador não tem nada para vender no momento.
        </p>
      ) : (
        shopState.inventory.map((item: ShopItem) => {
          const translatedItem = translateEquipment(item);
          const playerCanAfford = canAfford(character.currency, {
            quantity: item.cost.quantity,
            unit: item.cost.unit as 'gp' | 'sp' | 'pp' | 'cp' | 'ep',
          });
          const highlighted = highlightedItemId === item.id;

          return (
            <DndCard
              key={item.id}
              padding="sm"
              hover={false}
              className={cn(
                'flex justify-between gap-4 border transition',
                highlighted ? 'border-dnd-gold/60 shadow-[0_0_16px_var(--dnd-gold-glow)]' : 'border-dnd-gold/12'
              )}
            >
              <div className="min-w-0 space-y-1">
                <p className="font-ui text-[11px] uppercase tracking-wider text-dnd-parchment-muted">Oferta</p>
                <h4 className="truncate font-display text-lg font-semibold text-dnd-parchment">
                  {translatedItem.name}
                </h4>
                <p className="font-ui text-xs text-dnd-parchment-muted">
                  Qtd: {item.quantity === Infinity ? '∞' : item.quantity}
                </p>
              </div>
              <div className="text-right">
                <p className="font-ui text-[11px] uppercase tracking-wider text-dnd-parchment-muted">Preço</p>
                <p className="font-mono text-xl text-dnd-gold">
                  {item.cost.quantity} {item.cost.unit}
                </p>
                <DndButton
                  variant="ember"
                  size="sm"
                  className="mt-2"
                  disabled={isInteractionDisabled || !playerCanAfford}
                  onClick={() => {
                    buyItem(item as ShopItem, item.cost.quantity);
                    playCue('shop');
                    setHighlightedItemId(item.id);
                    setTimeout(() => setHighlightedItemId(null), 1200);
                  }}
                >
                  Comprar
                </DndButton>
              </div>
            </DndCard>
          );
        })
      )}
    </div>
  );

  const renderSellRows = () => (
    <div className="space-y-3">
      {character.inventory.length === 0 ? (
        <p className="py-6 text-center font-ui text-sm italic text-dnd-parchment-muted">
          Você não tem nada para vender.
        </p>
      ) : (
        character.inventory.map((item) => {
          const sellPrice = shopState.sellPrices[item.id] || Math.floor((item.cost?.quantity || 2) / 2);
          const translatedItem = translateEquipment(item);
          const highlighted = highlightedItemId === item.id;

          return (
            <DndCard
              key={item.id}
              padding="sm"
              hover={false}
              className={cn(
                'flex justify-between gap-4 border',
                highlighted ? 'border-dnd-success/50' : 'border-dnd-gold/12'
              )}
            >
              <div className="max-w-[60%] space-y-1">
                <p className="font-ui text-[11px] uppercase tracking-wider text-dnd-parchment-muted">
                  Inventário
                </p>
                <h4 className="truncate font-display text-lg font-semibold text-dnd-parchment">
                  {translatedItem.name}
                  {item.quantity > 1 ? ` (×${item.quantity})` : ''}
                </h4>
              </div>
              <div className="text-right">
                <p className="font-mono text-xl text-dnd-gold">{sellPrice} gp</p>
                <DndButton
                  variant="goldOutline"
                  size="sm"
                  className="mt-2"
                  disabled={isInteractionDisabled}
                  onClick={() => {
                    sellItem(item, sellPrice);
                    playCue('shop');
                    setHighlightedItemId(item.id);
                    setTimeout(() => setHighlightedItemId(null), 1200);
                  }}
                >
                  Vender
                </DndButton>
              </div>
            </DndCard>
          );
        })
      )}
    </div>
  );

  const tabNav = (
    <nav className="flex shrink-0 items-center justify-between gap-3 border-b border-dnd-gold/15 px-4 py-3 md:px-5">
      <div className="inline-flex rounded-full border border-dnd-gold/20 bg-dnd-obsidian p-1">
        {(['buy', 'sell'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-semibold transition',
              activeTab === tab
                ? 'bg-dnd-gold text-dnd-obsidian'
                : 'font-ui text-dnd-parchment-muted hover:text-dnd-gold'
            )}
          >
            {tab === 'buy' ? 'Comprar' : 'Vender'}
          </button>
        ))}
      </div>
      <span className="flex items-center gap-2 font-ui text-xs uppercase tracking-wider text-dnd-parchment-muted">
        <Coins className="h-4 w-4" />
        Cofre
      </span>
    </nav>
  );

  const haggleBanner = shopState.isHaggling ? (
    <div className="border-b border-dnd-gold/30 bg-dnd-gold/10 px-4 py-2 text-center font-ui text-sm text-dnd-gold">
      Negociando preços…
    </div>
  ) : null;

  return (
    <DndGameModalShell
      maxWidth="max-w-3xl"
      eyebrow="Mercador"
      title={shopState.name}
      subtitle={
        <span className="inline-flex items-center gap-2">
          <Wallet className="h-4 w-4 text-dnd-gold" />
          Seu ouro: <span className="font-mono font-semibold text-dnd-gold">{character.currency.gp} gp</span>
        </span>
      }
      onClose={handleClose}
      closeDisabled={isLoading}
      closeOnBackdrop={false}
    >
      {tabNav}
      {haggleBanner}
      <main className="p-4 md:p-5">{activeTab === 'buy' ? renderBuyRows() : renderSellRows()}</main>
    </DndGameModalShell>
  );
};

export default ShopModal;
