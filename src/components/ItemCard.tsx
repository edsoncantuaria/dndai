// components/ItemCard.tsx
import React, { useState, useMemo, useEffect } from 'react';
import type { InventoryItem, Proficiency } from '../types';
import { ChevronDown, Hand, Check, X, Loader2 } from 'lucide-react';
import * as DndApiService from '../services/dndApiService';
import { DndButton } from '@/components/primitives';
import { cn } from '@/lib/utils';

interface ItemCardProps {
  item: InventoryItem;
  variant?: 'legacy' | 'v2';
  onEquip?: (itemId: string) => void;
  onUnequip?: (itemId: string) => void;
  /** @deprecated use onEquip / onUnequip */
  onToggleEquip?: (itemId: string) => void;
  onUseConsumable?: (itemId: string) => void;
  actionDisabled?: boolean;
  equipPending?: boolean;
  defaultExpanded?: boolean;
  proficiencies: Proficiency[];
}

const ProficiencyIndicator: React.FC<{ proficient: boolean }> = ({ proficient }) => {
  const Icon = proficient ? Check : X;
  const color = proficient ? 'text-dnd-success' : 'text-dnd-danger';

  return (
    <div className={`flex items-center gap-1 text-xs font-semibold ${color}`} title={proficient ? 'Proficiente' : 'Não proficiente'}>
      <Icon className="h-4 w-4" />
    </div>
  );
};

function isPenaiEquipType(item: InventoryItem): boolean {
  const data = item as InventoryItem & { itemData?: { type?: string } };
  const t = data.itemData?.type;
  return t === 'weapon' || t === 'armor' || t === 'shield';
}

const ItemCard: React.FC<ItemCardProps> = ({
  item,
  variant = 'legacy',
  onEquip,
  onUnequip,
  onToggleEquip,
  onUseConsumable,
  actionDisabled,
  equipPending = false,
  defaultExpanded = false,
  proficiencies = [],
}) => {
  const isV2 = variant === 'v2';
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [detailedItem, setDetailedItem] = useState<InventoryItem | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (isExpanded && !detailedItem && item.index) {
      setLoadingDetails(true);
      DndApiService.getEquipmentDetails(item.index)
        .then((data) => {
          if (data) setDetailedItem(data);
        })
        .catch((err) =>
          console.warn(`[ItemCard] Falha ao carregar detalhes de ${item.index}:`, err)
        )
        .finally(() => setLoadingDetails(false));
    }
  }, [isExpanded, item, detailedItem]);

  const currentItem = detailedItem || item;

  const isProficient = useMemo(() => {
    if (!currentItem) return true;

    const normalizeKey = (str: string) => str.toLowerCase().replace(/\s+/g, '-');

    const characterProficiencies = new Set(proficiencies.map((p) => normalizeKey(p.index)));

    const checkProficiency = (key?: string): boolean => {
      if (!key) return false;
      const normalizedKey = normalizeKey(key);
      const singularKey = normalizedKey.endsWith('s') ? normalizedKey.slice(0, -1) : normalizedKey;
      const pluralKey = singularKey + 's';

      return (
        characterProficiencies.has(normalizedKey) ||
        characterProficiencies.has(singularKey) ||
        characterProficiencies.has(pluralKey)
      );
    };

    if (currentItem.armor_category && checkProficiency('all-armor')) return true;
    if (currentItem.weapon_category === 'Martial' && checkProficiency('martial-weapons')) return true;
    if (currentItem.weapon_category === 'Simple' && checkProficiency('simple-weapons')) return true;
    if (currentItem.equipment_category?.index === 'shields' && checkProficiency('shields')) return true;

    if (currentItem.armor_category && checkProficiency(`${currentItem.armor_category.toLowerCase()}-armor`)) {
      return true;
    }

    if (currentItem.index && checkProficiency(currentItem.index)) {
      return true;
    }

    if (
      currentItem.armor_category ||
      currentItem.weapon_category ||
      currentItem.equipment_category?.index === 'shields'
    ) {
      return false;
    }

    return true;
  }, [currentItem, proficiencies]);

  const canBeEquipped = !!(
    currentItem.weapon_category ||
    currentItem.armor_category ||
    currentItem.equipment_category?.index === 'shields' ||
    isPenaiEquipType(currentItem)
  );
  const canBeUsed = currentItem.consumable || currentItem.usable;
  const canEquipNow = canBeEquipped && isProficient && !actionDisabled && !equipPending;

  const handleEquip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEquipNow || currentItem.equipped) return;
    if (onEquip) onEquip(String(currentItem.id));
    else onToggleEquip?.(String(currentItem.id));
  };

  const handleUnequip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEquipNow || !currentItem.equipped) return;
    if (onUnequip) onUnequip(String(currentItem.id));
    else onToggleEquip?.(String(currentItem.id));
  };

  const handleCastClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUseConsumable && canBeUsed && !actionDisabled) {
      onUseConsumable(String(currentItem.id));
    }
  };

  return (
    <div
      className={cn(
        isV2
          ? 'rounded-md border bg-dnd-obsidian-raised/60 p-2.5'
          : 'rounded-lg border border-stone-700 bg-stone-800/70 p-3',
        isV2 && currentItem.equipped && canBeEquipped
          ? 'border-dnd-gold/50 ring-1 ring-dnd-gold/20'
          : isV2
            ? 'border-dnd-gold/15'
            : ''
      )}
    >
      <div
        className="flex cursor-pointer items-start justify-between"
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <div className="min-w-0 flex-grow">
          <h4 className={cn('font-semibold', isV2 ? 'text-dnd-parchment' : 'text-stone-200')}>
            {currentItem.name} {currentItem.quantity > 1 ? `(x${currentItem.quantity})` : ''}
          </h4>
          <div
            className={cn(
              'mt-1 flex flex-wrap items-center gap-2 text-xs',
              isV2 ? 'text-dnd-parchment-muted' : 'text-stone-400'
            )}
          >
            {currentItem.weight !== undefined && <span>{currentItem.weight} lbs</span>}
            {canBeEquipped && <ProficiencyIndicator proficient={isProficient} />}
            {canBeEquipped && currentItem.equipped && (
              <span className="rounded-full bg-dnd-gold/20 px-2 py-0.5 text-dnd-gold">Equipado</span>
            )}
            {canBeUsed && (
              <span className="rounded-full bg-dnd-ember/15 px-2 py-0.5 text-dnd-ember-hover">
                Consumível
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canBeUsed && onUseConsumable && (
            <button
              onClick={handleCastClick}
              disabled={actionDisabled}
              className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-dnd-parchment-muted hover:text-dnd-gold disabled:cursor-not-allowed disabled:opacity-50"
              title="Usar item"
              type="button"
            >
              <Hand className="h-4 w-4" />
            </button>
          )}
          <div className="flex shrink-0 p-1 text-dnd-parchment-muted">
            <ChevronDown
              className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          </div>
        </div>
      </div>

      {canBeEquipped && (onEquip || onUnequip || onToggleEquip) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {equipPending ? (
            <DndButton variant="ghost" size="sm" disabled className="min-h-[44px]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Aguardando motor…
            </DndButton>
          ) : currentItem.equipped ? (
            <DndButton
              variant="ghost"
              size="sm"
              className="min-h-[44px]"
              disabled={!canEquipNow}
              onClick={handleUnequip}
            >
              Desequipar
            </DndButton>
          ) : (
            <DndButton
              variant="goldOutline"
              size="sm"
              className="min-h-[44px]"
              disabled={!canEquipNow}
              onClick={handleEquip}
            >
              Equipar
            </DndButton>
          )}
        </div>
      )}

      {isExpanded && (
        <div
          className={cn(
            'mt-2 space-y-2 border-t pt-2 text-sm',
            isV2 ? 'border-dnd-gold/15 text-dnd-parchment' : 'border-stone-600/50 text-stone-300'
          )}
        >
          {loadingDetails && (
            <div className="flex items-center text-xs italic text-dnd-parchment-muted">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Carregando detalhes…
            </div>
          )}

          {currentItem.desc && currentItem.desc.length > 0 && (
            <div className="space-y-1 text-xs italic text-dnd-parchment-muted">
              {currentItem.desc.map((d, i) => (
                <p key={i}>{d}</p>
              ))}
            </div>
          )}

          {currentItem.damage && (
            <p>
              <strong className="font-semibold text-dnd-parchment-muted">Dano:</strong>{' '}
              {currentItem.damage?.damage_dice} {currentItem.damage?.damage_type?.name}
            </p>
          )}
          {currentItem.armor_class && (
            <p>
              <strong className="font-semibold text-dnd-parchment-muted">CA base:</strong>{' '}
              {currentItem.armor_class.base}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ItemCard;
