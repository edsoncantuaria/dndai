// src/components/ShopModal.tsx
'use client';
import React, { useState } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import { ShopItem } from '../types';
import { translateEquipment } from '../utils/translator';
import { canAfford } from '@/utils/currency';
import { useEventFeedback } from '@/hooks/useEventFeedback';
import { Coins, Store, Wallet, X } from 'lucide-react';
import { isUiV2Enabled } from '@/lib/uiV2';
import { DndButton, DndCard } from '@/components/primitives';
import { DndGameModalShell } from '@/features/gameplay/modals/DndGameModalShell';
import { cn } from '@/lib/utils';

const PANEL_LEGACY =
  'rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-2xl shadow-[0_30px_70px_rgba(0,0,0,0.55)]';

const ShopModal: React.FC = () => {
  const { shopState, character, buyItem, sellItem, processPlayerAction, isLoading } =
    useGameStateContext();
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const { playCue } = useEventFeedback();
  const isV2 = isUiV2Enabled();

  if (!shopState?.isOpen || !character) {
    return null;
  }

  const handleClose = () => {
    processPlayerAction('Eu saio da loja.');
  };

  const isInteractionDisabled = isLoading || shopState.isHaggling;

  const renderBuyRows = (v2: boolean) => (
    <div className="space-y-3">
      {shopState.inventory.length === 0 ? (
        <p
          className={cn(
            'py-6 text-center italic',
            v2 ? 'font-ui text-sm text-dnd-parchment-muted' : 'text-stone-400'
          )}
        >
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

          const row = (
            <>
              <div className="min-w-0 space-y-1">
                <p
                  className={cn(
                    'text-[11px] uppercase tracking-wider',
                    v2 ? 'font-ui text-dnd-parchment-muted' : 'text-stone-500'
                  )}
                >
                  Oferta
                </p>
                <h4
                  className={cn(
                    'truncate text-lg font-semibold',
                    v2 ? 'font-display text-dnd-parchment' : 'text-white'
                  )}
                >
                  {translatedItem.name}
                </h4>
                <p className={v2 ? 'font-ui text-xs text-dnd-parchment-muted' : 'text-xs text-stone-400'}>
                  Qtd: {item.quantity === Infinity ? '∞' : item.quantity}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={cn(
                    'text-[11px] uppercase tracking-wider',
                    v2 ? 'font-ui text-dnd-parchment-muted' : 'text-stone-500'
                  )}
                >
                  Preço
                </p>
                <p className={cn('font-mono text-xl', v2 ? 'text-dnd-gold' : 'text-amber-300')}>
                  {item.cost.quantity} {item.cost.unit}
                </p>
                {v2 ? (
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
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      buyItem(item as ShopItem, item.cost.quantity);
                      playCue('shop');
                      setHighlightedItemId(item.id);
                      setTimeout(() => setHighlightedItemId(null), 1200);
                    }}
                    disabled={isInteractionDisabled || !playerCanAfford}
                    className="mt-3 inline-flex rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 px-4 py-1.5 text-sm font-semibold text-stone-900 disabled:opacity-40"
                  >
                    Comprar
                  </button>
                )}
              </div>
            </>
          );

          if (v2) {
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
                {row}
              </DndCard>
            );
          }

          return (
            <div
              key={item.id}
              className={cn(
                'flex items-center justify-between gap-4 rounded-2xl border bg-black/35 p-4 backdrop-blur-sm transition-all',
                highlighted ? 'border-amber-400/70' : 'border-white/5'
              )}
            >
              {row}
            </div>
          );
        })
      )}
    </div>
  );

  const renderSellRows = (v2: boolean) => (
    <div className="space-y-3">
      {character.inventory.length === 0 ? (
        <p
          className={cn(
            'py-6 text-center italic',
            v2 ? 'font-ui text-sm text-dnd-parchment-muted' : 'text-stone-400'
          )}
        >
          Você não tem nada para vender.
        </p>
      ) : (
        character.inventory.map((item) => {
          const sellPrice = shopState.sellPrices[item.id] || Math.floor((item.cost?.quantity || 2) / 2);
          const translatedItem = translateEquipment(item);
          const highlighted = highlightedItemId === item.id;

          const row = (
            <>
              <div className="max-w-[60%] space-y-1">
                <p
                  className={cn(
                    'text-[11px] uppercase tracking-wider',
                    v2 ? 'font-ui text-dnd-parchment-muted' : 'text-stone-500'
                  )}
                >
                  Inventário
                </p>
                <h4
                  className={cn(
                    'truncate text-lg font-semibold',
                    v2 ? 'font-display text-dnd-parchment' : 'text-white'
                  )}
                >
                  {translatedItem.name}
                  {item.quantity > 1 ? ` (×${item.quantity})` : ''}
                </h4>
              </div>
              <div className="text-right">
                <p className={cn('font-mono text-xl', v2 ? 'text-dnd-gold' : 'text-amber-300')}>
                  {sellPrice} gp
                </p>
                {v2 ? (
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
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      sellItem(item, sellPrice);
                      playCue('shop');
                      setHighlightedItemId(item.id);
                      setTimeout(() => setHighlightedItemId(null), 1200);
                    }}
                    disabled={isInteractionDisabled}
                    className="mt-3 inline-flex rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-4 py-1.5 text-sm font-semibold text-stone-900 disabled:opacity-40"
                  >
                    Vender
                  </button>
                )}
              </div>
            </>
          );

          if (v2) {
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
                {row}
              </DndCard>
            );
          }

          return (
            <div
              key={item.id}
              className={cn(
                'flex items-center justify-between gap-4 rounded-2xl border bg-black/35 p-4',
                highlighted ? 'border-emerald-400/70' : 'border-white/5'
              )}
            >
              {row}
            </div>
          );
        })
      )}
    </div>
  );

  const tabNav = (v2: boolean) => (
    <nav
      className={cn(
        'flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 md:px-5',
        v2 ? 'border-dnd-gold/15' : 'border-white/10 px-6 py-4'
      )}
    >
      <div
        className={cn(
          'inline-flex rounded-full p-1',
          v2 ? 'border border-dnd-gold/20 bg-dnd-obsidian' : 'border border-white/10 bg-black/30'
        )}
      >
        {(['buy', 'sell'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-semibold transition',
              v2
                ? activeTab === tab
                  ? 'bg-dnd-gold text-dnd-obsidian'
                  : 'font-ui text-dnd-parchment-muted hover:text-dnd-gold'
                : activeTab === tab
                  ? 'bg-white/90 text-stone-900'
                  : 'text-stone-400'
            )}
          >
            {tab === 'buy' ? 'Comprar' : 'Vender'}
          </button>
        ))}
      </div>
      <span
        className={cn(
          'flex items-center gap-2 text-xs uppercase tracking-wider',
          v2 ? 'font-ui text-dnd-parchment-muted' : 'text-stone-400'
        )}
      >
        <Coins className="h-4 w-4" />
        Cofre
      </span>
    </nav>
  );

  const haggleBanner = shopState.isHaggling ? (
    <div
      className={cn(
        'border-b px-4 py-2 text-center text-sm',
        isV2
          ? 'border-dnd-gold/30 bg-dnd-gold/10 font-ui text-dnd-gold'
          : 'border-amber-400/40 bg-amber-500/10 text-amber-200'
      )}
    >
      Negociando preços…
    </div>
  ) : null;

  if (isV2) {
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
        {tabNav(true)}
        {haggleBanner}
        <main className="p-4 md:p-5">{activeTab === 'buy' ? renderBuyRows(true) : renderSellRows(true)}</main>
      </DndGameModalShell>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#04060a]/90 backdrop-blur">
      <div className={`${PANEL_LEGACY} flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden`}>
        <header className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-amber-200">
              <Store className="h-4 w-4" /> Loja Premium
            </p>
            <h2 className="font-serif text-3xl leading-tight text-white">{shopState.name}</h2>
            <p className="flex items-center gap-2 text-sm text-stone-400">
              <Wallet className="h-4 w-4 text-amber-200" />
              Seu Ouro: <span className="font-mono font-semibold text-amber-300">{character.currency.gp} gp</span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="rounded-full border border-white/15 p-2 text-stone-300 transition hover:text-white"
            aria-label="Fechar loja"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        {tabNav(false)}
        {haggleBanner}
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          {activeTab === 'buy' ? renderBuyRows(false) : renderSellRows(false)}
        </main>
      </div>
    </div>
  );
};

export default ShopModal;
