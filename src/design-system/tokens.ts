/** Tokens TypeScript — espelho de tokens.css para uso em JS/TS */

export const dndColors = {
  ember: '#e40712',
  emberHover: '#ff2430',
  emberDeep: '#9b0610',
  gold: '#d4af37',
  goldBright: '#f0d878',
  goldDim: '#7a6520',
  obsidian: '#050506',
  obsidianRaised: '#121216',
  parchment: '#f7f0e3',
  parchmentMuted: '#b8a88c',
  mist: 'rgba(255, 255, 255, 0.07)',
  mistStrong: 'rgba(255, 255, 255, 0.12)',
  success: '#2d8a4e',
  danger: '#e40712',
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
