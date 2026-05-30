import type { LucideIcon } from 'lucide-react';
import {
  CheckCircle2,
  Crown,
  Languages,
  ScrollText,
  Shield,
  Sparkles,
  Stars,
  Swords,
} from 'lucide-react';
import type { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import { areAttributesComplete, getStepCompleteness } from './stepCompleteness';

export type SheetBlockId =
  | 'identity'
  | 'attributes'
  | 'history'
  | 'proficiencies'
  | 'equipment'
  | 'spells'
  | 'feats'
  | 'reveal';

export type SheetBlockDef = {
  id: SheetBlockId;
  step: number;
  title: string;
  hint: string;
  icon: LucideIcon;
  /** Ocultar bloco quando não aplicável (ex.: talentos só humano variante) */
  visible?: (hook: ReturnType<typeof useCharacterCreator>) => boolean;
};

export const SHEET_BLOCKS: SheetBlockDef[] = [
  {
    id: 'identity',
    step: 1,
    title: 'Identidade',
    hint: 'Raça, sub-raça e classe',
    icon: Sparkles,
  },
  {
    id: 'attributes',
    step: 2,
    title: 'Atributos',
    hint: 'Compra de pontos ou rolagem',
    icon: Swords,
  },
  {
    id: 'history',
    step: 3,
    title: 'História',
    hint: 'Antecedente, alinhamento e personalidade',
    icon: ScrollText,
  },
  {
    id: 'proficiencies',
    step: 4,
    title: 'Perícias',
    hint: 'Proficiências e idiomas extras',
    icon: Languages,
  },
  {
    id: 'equipment',
    step: 5,
    title: 'Equipamento',
    hint: 'Escolhas de armas e pacotes',
    icon: Shield,
  },
  {
    id: 'spells',
    step: 6,
    title: 'Magias',
    hint: 'Truques e magias iniciais',
    icon: Stars,
  },
  {
    id: 'feats',
    step: 7,
    title: 'Talentos',
    hint: 'Talento do humano variante',
    icon: Crown,
    visible: (hook) => hook.isVariantHuman,
  },
  {
    id: 'reveal',
    step: 8,
    title: 'Revelação',
    hint: 'Nome, aparência e confirmação',
    icon: CheckCircle2,
  },
];

export function getVisibleBlocks(hook: ReturnType<typeof useCharacterCreator>): SheetBlockDef[] {
  return SHEET_BLOCKS.filter((b) => !b.visible || b.visible(hook));
}

export function isBlockComplete(step: number, hook: ReturnType<typeof useCharacterCreator>): boolean {
  if (step === 7 && !hook.isVariantHuman) return true;
  return getStepCompleteness(step, hook);
}

export function isBlockLocked(step: number, hook: ReturnType<typeof useCharacterCreator>): boolean {
  for (let s = 1; s < step; s++) {
    if (!isBlockComplete(s, hook)) return true;
  }
  return false;
}

export function getBlockSummary(
  block: SheetBlockDef,
  hook: ReturnType<typeof useCharacterCreator>,
): string {
  const { details } = hook;
  switch (block.id) {
    case 'identity': {
      const parts = [
        details.raceDetails?.name || hook.race,
        details.subraceDetails?.name,
        details.classDetails?.name || hook.characterClass,
      ].filter(Boolean);
      return parts.length ? parts.join(' · ') : 'Toque para escolher raça e classe';
    }
    case 'attributes': {
      if (!hook.attributeMethod) {
        return 'Escolha compra de pontos ou rolar dados';
      }
      if (!areAttributesComplete(hook)) {
        if (hook.attributeMethod === 'point-buy') {
          return `Compra de pontos · ${hook.points} pontos restantes`;
        }
        return 'Role os dados para gerar os atributos';
      }
      const attrs = hook.finalAttributes || hook.baseAttributes;
      const preview = ['strength', 'dexterity', 'constitution']
        .map((k) => attrs?.[k as keyof typeof attrs])
        .filter((v) => v != null);
      if (preview.length === 3) {
        return `${hook.attributeMethod === 'point-buy' ? 'Pontos' : 'Rolagem'} · FOR ${preview[0]} DES ${preview[1]} CON ${preview[2]}…`;
      }
      return hook.attributeMethod === 'point-buy' ? 'Compra de pontos concluída' : 'Atributos rolados';
    }
    case 'history': {
      const parts = [
        details.backgroundDetails?.name || hook.background,
        hook.alignment,
      ].filter(Boolean);
      if (parts.length) return parts.join(' · ');
      return 'Antecedente e traços de personalidade';
    }
    case 'proficiencies':
      return hook.canProceedFromProficiencies
        ? 'Perícias e idiomas definidos'
        : 'Escolha perícias e idiomas restantes';
    case 'equipment':
      return hook.areAllEquipmentChoicesMade ? 'Equipamento completo' : 'Confirme escolhas de equipamento';
    case 'spells': {
      const hasClassSpells = hook.cantripsKnown > 0 || hook.spellsKnown > 0;
      const hasRacial = (hook.racialSpellTraits || []).length > 0;
      if (!hasClassSpells && !hasRacial) return 'Classe sem magias iniciais';
      if (hook.areClassSpellsSelected && hook.areRacialSpellsSelected) {
        return `${hook.chosenClassSpells?.length ?? 0} magias selecionadas`;
      }
      return 'Selecione truques e magias';
    }
    case 'feats':
      return hook.selectedFeat ? 'Talento escolhido' : 'Escolha um talento inicial';
    case 'reveal':
      return hook.name ? hook.name : 'Nome, aparência e selar a ficha';
    default:
      return block.hint;
  }
}

export function countCompleteBlocks(hook: ReturnType<typeof useCharacterCreator>): {
  done: number;
  total: number;
} {
  const blocks = getVisibleBlocks(hook);
  const done = blocks.filter((b) => isBlockComplete(b.step, hook)).length;
  return { done, total: blocks.length };
}
