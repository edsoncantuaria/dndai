// components/ItemCard.tsx
import React, { useState, useMemo, useEffect } from 'react';
import type { InventoryItem, Proficiency } from '../types';
import { Shield, ChevronDown, Hand, Check, X, Loader2 } from 'lucide-react';
import * as DndApiService from '../services/dndApiService';

interface ItemCardProps {
  item: InventoryItem;
  onToggleEquip?: (itemId: string) => void;
  onUseConsumable?: (itemId: string) => void;
  actionDisabled?: boolean;
  defaultExpanded?: boolean;
  proficiencies: Proficiency[];
}

const ProficiencyIndicator: React.FC<{ proficient: boolean }> = ({ proficient }) => {
  const Icon = proficient ? Check : X;
  const color = proficient ? 'text-green-400' : 'text-red-500';
  const text = proficient ? 'Proficiente' : 'Não Proficiente';

  return (
    <div className={`flex items-center gap-1 text-xs font-semibold ${color}`} title={text}>
      <Icon className="h-4 w-4" />
    </div>
  );
};

const ItemCard: React.FC<ItemCardProps> = ({
  item,
  onToggleEquip,
  onUseConsumable,
  actionDisabled,
  defaultExpanded = false,
  proficiencies = [],
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [detailedItem, setDetailedItem] = useState<InventoryItem | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // 🔄 Lazy load dos detalhes quando o item é expandido
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
  
    const characterProficiencies = new Set(
      proficiencies.map((p) => normalizeKey(p.index))
    );
  
    const checkProficiency = (key?: string): boolean => {
      if (!key) return false;
      const normalizedKey = normalizeKey(key);
      const singularKey = normalizedKey.endsWith('s') ? normalizedKey.slice(0, -1) : normalizedKey;
      const pluralKey = singularKey + 's';
      
      return characterProficiencies.has(normalizedKey) || characterProficiencies.has(singularKey) || characterProficiencies.has(pluralKey);
    };
  
    // 1. General proficiencies
    if (currentItem.armor_category && checkProficiency('all-armor')) return true;
    if (currentItem.weapon_category === 'Martial' && checkProficiency('martial-weapons')) return true;
    if (currentItem.weapon_category === 'Simple' && checkProficiency('simple-weapons')) return true;
    if (currentItem.equipment_category?.index === 'shields' && checkProficiency('shields')) return true;
  
    // 2. Specific category proficiencies
    if (currentItem.armor_category && checkProficiency(`${currentItem.armor_category.toLowerCase()}-armor`)) {
      return true;
    }
  
    // 3. Specific item proficiency by index (e.g., 'longsword')
    if (currentItem.index && checkProficiency(currentItem.index)) {
      return true;
    }
  
    // 4. Default to not proficient for items requiring proficiency, if no match found
    if (
      currentItem.armor_category ||
      currentItem.weapon_category ||
      currentItem.equipment_category?.index === 'shields'
    ) {
      return false;
    }
  
    // True for items that don't require proficiency (like general gear)
    return true;
  }, [currentItem, proficiencies]);


  const canBeEquipped = !!(
    currentItem.weapon_category ||
    currentItem.armor_category ||
    currentItem.equipment_category?.index === 'shields'
  );
  const canBeUsed = currentItem.consumable || currentItem.usable;
  const canEquipNow = canBeEquipped && isProficient && !actionDisabled;

  const handleCastClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUseConsumable && canBeUsed && !actionDisabled) {
      onUseConsumable(currentItem.id);
    }
  };

  const handleToggleEquipClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleEquip && canEquipNow) {
      onToggleEquip(currentItem.id);
    }
  };

  return (
    <div className="bg-stone-800/70 p-3 rounded-lg border border-stone-700">
      <div
        className="flex justify-between items-start cursor-pointer"
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <div className="flex-grow">
          <h4 className="font-semibold text-stone-200">
            {currentItem.name} {currentItem.quantity > 1 ? `(x${currentItem.quantity})` : ''}
          </h4>
          <div className="flex items-center gap-2 text-xs text-stone-400 mt-1">
            {currentItem.weight !== undefined && <span>{currentItem.weight} lbs</span>}
            {canBeEquipped && <ProficiencyIndicator proficient={isProficient} />}
            {canBeEquipped && (
              <span
                className={`px-2 py-0.5 rounded-full ${
                  currentItem.equipped
                    ? 'bg-amber-800 text-amber-200'
                    : 'bg-stone-600 text-stone-300'
                }`}
              >
                {currentItem.equipped ? 'Equipado' : 'Desequipado'}
              </span>
            )}
            {canBeUsed && (
              <span className="px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300">
                Consumível/Usável
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center">
          {canBeUsed && onUseConsumable && (
            <button
              onClick={handleCastClick}
              disabled={actionDisabled}
              className="p-1 text-stone-400 hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Usar Item"
            >
              <Hand />
            </button>
          )}
          {canBeEquipped && onToggleEquip && (
            <button
              onClick={handleToggleEquipClick}
              disabled={!canEquipNow}
              className="p-1 text-stone-400 hover:text-amber-300 disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                isProficient
                  ? currentItem.equipped
                    ? 'Desequipar'
                    : 'Equipar'
                  : 'Proficiência necessária'
              }
            >
              <Shield />
            </button>
          )}
          <div className="p-1 text-stone-400 hover:text-amber-300 flex-shrink-0">
            <ChevronDown
              className={`h-5 w-5 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-2 text-sm text-stone-300 space-y-2 pt-2 border-t border-stone-600/50">
          {loadingDetails && (
            <div className="flex items-center text-xs text-stone-500 italic">
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Carregando detalhes...
            </div>
          )}

          {currentItem.desc && currentItem.desc.length > 0 && (
            <div className="text-stone-400 text-xs italic space-y-1">
              {currentItem.desc.map((d, i) => (
                <p key={i}>{d}</p>
              ))}
            </div>
          )}

          {currentItem.damage && (
            <p>
              <strong className="font-semibold text-stone-400">Dano:</strong>{' '}
              {currentItem.damage?.damage_dice} {currentItem.damage?.damage_type?.name}
            </p>
          )}
          {currentItem.two_handed_damage && (
            <p>
              <strong className="font-semibold text-stone-400">Dano (2 Mãos):</strong>{' '}
              {currentItem.two_handed_damage?.damage_dice}{' '}
              {currentItem.two_handed_damage?.damage_type?.name}
            </p>
          )}
          {currentItem.properties && currentItem.properties.length > 0 && (
            <p>
              <strong className="font-semibold text-stone-400">Propriedades:</strong>{' '}
              {currentItem.properties.map((p) => p.name).join(', ')}
            </p>
          )}

          {currentItem.armor_class && (
            <p>
              <strong className="font-semibold text-stone-400">Classe de Armadura (CA):</strong>{' '}
              {currentItem.armor_class.base}{' '}
              {currentItem.armor_class.dex_bonus
                ? `+ Mod de Destreza${
                    currentItem.armor_class.max_bonus
                      ? ` (máx ${currentItem.armor_class.max_bonus})`
                      : ''
                  }`
                : ''}
            </p>
          )}
          {!!currentItem.str_minimum && currentItem.str_minimum > 0 && (
            <p>
              <strong className="font-semibold text-stone-400">Força Mínima:</strong>{' '}
              {currentItem.str_minimum}
            </p>
          )}
          {currentItem.stealth_disadvantage && (
            <p className="text-red-400">Desvantagem em testes de Furtividade.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ItemCard;
