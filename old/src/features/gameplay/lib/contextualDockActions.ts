import type { ShopState } from '@/types';

export type PenaiMotorActionOption = {
    text: string;
    action: string;
    skill?: string;
    needsRoll?: boolean;
    dc?: number;
};

export type ActionOptionInput = string | PenaiMotorActionOption;

const SKILL_PT: Record<string, string> = {
    perception: 'Percepção',
    investigation: 'Investigação',
    persuasion: 'Persuasão',
    stealth: 'Furtividade',
    athletics: 'Atletismo',
    insight: 'Intuição',
    intimidation: 'Intimidação',
    deception: 'Enganação',
    acrobatics: 'Acrobacia',
    survival: 'Sobrevivência',
};

const SHOP_OPTION_HINTS =
    /\b(loja|mercador|mercadoria|comerciar|negociar|comprar|vender|ferreiro|armeiro|taverneiro|shop)\b/i;
const QUEST_OPTION_HINTS =
    /\b(missão|objetivo|quest|contrato|entregar|concluir|completar|recompensa da missão)\b/i;

export function formatActionOptionLabel(option: ActionOptionInput): string {
    if (typeof option === 'string') return option.trim();
    const label = option.text?.trim() || option.action?.trim() || '';
    if (!label) return '';
    if (option.needsRoll && option.skill) {
        const skill = SKILL_PT[option.skill] ?? option.skill;
        const dc = option.dc ? ` CD ${option.dc}` : '';
        return `${label} · ${skill}${dc}`;
    }
    return label;
}

export function collectOptionTexts(options: ActionOptionInput[]): string[] {
    return options.map(formatActionOptionLabel).filter(Boolean);
}

export function optionsMatch(pattern: RegExp, options: string[]): boolean {
    return options.some(text => pattern.test(text));
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
