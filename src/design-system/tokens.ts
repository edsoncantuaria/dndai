/** Tokens TypeScript — espelho de tokens.css para uso em JS/TS */

export const dndColors = {
  ember: '#C41E3A',
  emberHover: '#D42A48',
  gold: '#C9A227',
  goldDim: '#8A7020',
  obsidian: '#0A0A0C',
  obsidianRaised: '#141418',
  parchment: '#F4E8D0',
  parchmentMuted: '#C9B89A',
  mist: 'rgba(255, 255, 255, 0.08)',
  success: '#2D8A4E',
  danger: '#B91C1C',
} as const;

export const dndSpacing = {
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
} as const;

export const dndMotion = {
  durationUi: '200ms',
  durationScene: '700ms',
  durationSceneSlow: '900ms',
  easeOutExpo: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const;

export const dndBreakpoints = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export type BreakpointKey = keyof typeof dndBreakpoints;
