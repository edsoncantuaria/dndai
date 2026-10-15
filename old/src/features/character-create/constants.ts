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

export const CREATION_STEPS = [
  { id: 1, title: 'Raça & Classe', description: 'Legado e vocação', icon: Sparkles },
  { id: 2, title: 'Atributos', description: 'Poder e potencial', icon: Swords },
  { id: 3, title: 'Antecedente', description: 'História pessoal', icon: ScrollText },
  { id: 4, title: 'Perícias', description: 'Talentos e idiomas', icon: Languages },
  { id: 5, title: 'Equipamentos', description: 'Armas e armaduras', icon: Shield },
  { id: 6, title: 'Magias', description: 'Repertório arcano', icon: Stars },
  { id: 7, title: 'Talentos', description: 'Feitos memoráveis', icon: Crown },
  { id: 8, title: 'Revelação', description: 'Seu herói desperta', icon: CheckCircle2 },
] as const satisfies ReadonlyArray<{
  id: number;
  title: string;
  description: string;
  icon: LucideIcon;
}>;

export const TOTAL_CREATION_STEPS = CREATION_STEPS.length;
