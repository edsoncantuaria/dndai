import type { ComponentProps } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export type RealmId = 'fighter' | 'wizard' | 'rogue' | 'cleric' | 'ranger';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type Realm = {
  id: RealmId;
  name: string;
  tagline: string;
  orbitLabel: string;
  color: string;
  icon: IconName;
  /** Ordem no anel (0 = mais próximo do centro visual) */
  orbitIndex: number;
};

/** “Planetas” do anel — inspiração Solar System Explorer, temática D&D */
export const REALMS: Realm[] = [
  {
    id: 'fighter',
    name: 'Guerreiro',
    tagline: 'Aço, honra e golpes que abalam muralhas.',
    orbitLabel: 'Linha de frente',
    color: '#c9a227',
    icon: 'sword-cross',
    orbitIndex: 0,
  },
  {
    id: 'wizard',
    name: 'Mago',
    tagline: 'Segredos arcanos e fogo que desafia o destino.',
    orbitLabel: 'Torre arcana',
    color: '#7c5cff',
    icon: 'auto-fix',
    orbitIndex: 1,
  },
  {
    id: 'rogue',
    name: 'Ladino',
    tagline: 'Sombras, sorte e lâminas que ninguém vê chegar.',
    orbitLabel: 'Beco sombrio',
    color: '#5ec8e8',
    icon: 'knife-military',
    orbitIndex: 2,
  },
  {
    id: 'cleric',
    name: 'Clérigo',
    tagline: 'Luz sagrada e juramentos que curam a party.',
    orbitLabel: 'Santuário',
    color: '#3d9b5a',
    icon: 'shield-cross',
    orbitIndex: 3,
  },
  {
    id: 'ranger',
    name: 'Patrulheiro',
    tagline: 'Floresta viva, rastros e flechas certeiras.',
    orbitLabel: 'Trilha selvagem',
    color: '#e85d3a',
    icon: 'bow-arrow',
    orbitIndex: 4,
  },
];

export const INTRO_SLIDES = [
  {
    title: 'Crônicas narradas por IA',
    body: 'Cada escolha molda um mundo vivo. O texto é o palco — a imaginação, o limite.',
  },
  {
    title: 'Mestre virtual à mesa',
    body: 'Regras de D&D, combate estruturado e diário automático — sem perder a imersão.',
  },
  {
    title: 'Dados de verdade',
    body: 'Rolagens físicas em tela cheia. Críticos brilham; falhas ecoam nas sombras.',
  },
] as const;
