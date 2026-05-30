import type { ShopState } from '@/types';

const SHOP_OPTION_HINTS =
  /\b(loja|mercador|mercadoria|comerciar|negociar|comprar|vender|ferreiro|armeiro|taverneiro|shop)\b/i;
const QUEST_OPTION_HINTS =
  /\b(missão|objetivo|quest|contrato|entregar|concluir|completar|recompensa da missão)\b/i;

function normalizeOptionText(action: string | { text: string; action: string; skill?: string }): string {
  if (typeof action === 'string') return action.trim();
  const label = action.text?.trim();
  if (label && label.length >= 4) return label;
  return action.action?.trim() ?? '';
}

export function collectOptionTexts(
  options: (string | { text: string; action: string; skill?: string })[]
): string[] {
  return options.map(normalizeOptionText).filter(Boolean);
}

export function optionsMatch(pattern: RegExp, options: string[]): boolean {
  return options.some((text) => pattern.test(text));
}

export type ContextualDockVisibility = {
  showReopenShop: boolean;
  shopLabel: string;
  showQuestComplete: boolean;
  showSrdTools: boolean;
  showSpellTools: boolean;
};

export function resolveContextualDockVisibility(input: {
  combatActive: boolean;
  actionOptionTexts: string[];
  shopState: ShopState | null;
  knownSpellCount?: number;
}): ContextualDockVisibility {
  const { combatActive, actionOptionTexts, shopState } = input;
  const knownSpellCount = input.knownSpellCount ?? 0;

  const hasShopCatalog = Boolean(shopState?.inventory?.length);
  const shopHintsInOptions = optionsMatch(SHOP_OPTION_HINTS, actionOptionTexts);
  const showReopenShop =
    !combatActive && hasShopCatalog && !shopState?.isOpen && shopHintsInOptions;

  const showQuestComplete =
    !combatActive && optionsMatch(QUEST_OPTION_HINTS, actionOptionTexts);

  const showSrdTools = combatActive;
  const showSpellTools = !combatActive && knownSpellCount > 0;

  return {
    showReopenShop,
    shopLabel: shopState?.merchantName ?? shopState?.name ?? 'Mercador',
    showQuestComplete,
    showSrdTools,
    showSpellTools,
  };
}
