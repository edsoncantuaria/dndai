import type { LucideIcon } from 'lucide-react';
import { FileJson, Layers, SlidersHorizontal } from 'lucide-react';

export type HomebrewCreatorStepId = 'meta' | 'structure' | 'review';

export const HOMEBREW_CREATOR_STEPS: {
  id: HomebrewCreatorStepId;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  { id: 'meta', label: 'Origem', description: 'Tipo, SRD e visibilidade', icon: SlidersHorizontal },
  { id: 'structure', label: 'Estrutura', description: 'Campos do conteúdo', icon: Layers },
  { id: 'review', label: 'Revisão', description: 'Conferir e salvar', icon: FileJson },
];

export const creatorSelectClass =
  'dnd-field min-h-[44px] w-full rounded-md border px-4 py-2 font-ui text-base shadow-inner focus:border-dnd-gold focus:outline-none focus:ring-2 focus:ring-dnd-gold/35';
