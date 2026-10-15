/** Classes compartilhadas dos formulários homebrew (design system v2) */
export const hb = {
  root: 'hb-form space-y-4',
  label: 'mb-1 block font-ui text-xs font-semibold uppercase tracking-wider text-dnd-parchment',
  control:
    'dnd-field min-h-[44px] w-full rounded-md border px-4 py-2 font-ui text-base shadow-inner placeholder:text-dnd-parchment-muted focus:border-dnd-gold focus:outline-none focus:ring-2 focus:ring-dnd-gold/35',
  controlSm:
    'dnd-field min-h-[36px] w-full rounded-md border px-3 py-1.5 font-ui text-sm shadow-inner focus:border-dnd-gold focus:outline-none focus:ring-2 focus:ring-dnd-gold/35',
  textarea:
    'dnd-field min-h-[88px] w-full resize-y rounded-md border px-4 py-3 font-narrative text-base leading-relaxed shadow-inner placeholder:text-dnd-parchment-muted focus:border-dnd-gold focus:outline-none focus:ring-2 focus:ring-dnd-gold/35',
  checkbox:
    'h-4 w-4 shrink-0 rounded border-dnd-gold/40 bg-dnd-obsidian-raised text-dnd-gold focus:ring-2 focus:ring-dnd-gold/30',
  checkLabel: 'flex cursor-pointer items-center gap-2 font-ui text-sm text-dnd-parchment',
  section: 'space-y-3 rounded-lg border border-dnd-gold/15 bg-dnd-obsidian-raised/35 p-4',
  sectionTitle: 'font-display text-sm text-dnd-gold',
  sectionSubtitle: 'font-ui text-xs text-dnd-parchment-muted',
  muted: 'font-ui text-xs text-dnd-parchment-muted',
  btnAdd:
    'inline-flex items-center gap-1.5 rounded-md border border-dnd-gold/30 bg-dnd-gold/15 px-3 py-1.5 font-ui text-xs font-semibold text-dnd-gold transition hover:bg-dnd-gold/25',
  btnDanger:
    'inline-flex items-center gap-1 rounded-md border border-dnd-danger/40 bg-dnd-danger/10 px-2 py-1 font-ui text-xs text-red-300 transition hover:bg-dnd-danger/20',
  btnGhost:
    'inline-flex items-center gap-1.5 font-ui text-xs text-dnd-parchment-muted transition hover:text-dnd-gold',
  listItem:
    'flex flex-wrap items-center justify-between gap-2 rounded-md border border-dnd-gold/10 bg-dnd-obsidian/60 px-3 py-2',
  divider: 'border-t border-dnd-gold/10 pt-4',
  dividerSection: 'space-y-4 border-t border-dnd-gold/15 pt-4',
  heading: 'mb-4 font-display text-lg text-dnd-gold',
  headingSm: 'mb-2 font-ui text-sm font-medium text-dnd-parchment-muted',
  headingBorder: 'border-b border-dnd-gold/25 pb-2 font-display text-lg text-dnd-gold',
  chip: 'rounded-full border border-dnd-gold/20 bg-dnd-obsidian-raised/70 px-2 py-1 font-ui text-xs text-dnd-parchment-muted transition hover:border-dnd-gold/40',
  chipSelected: 'rounded-full border border-dnd-gold/50 bg-dnd-gold/20 px-2 py-1 font-ui text-xs text-dnd-gold',
  tile: 'flex cursor-pointer items-center gap-2 rounded-md border border-dnd-gold/15 bg-dnd-obsidian-raised/50 p-2 font-ui text-sm text-dnd-parchment transition',
  tileSelected: 'flex cursor-pointer items-center gap-2 rounded-md border border-dnd-gold/40 bg-dnd-gold/15 p-2 font-ui text-sm text-dnd-parchment transition',
  row: 'flex items-center gap-2 rounded-md bg-dnd-obsidian/50 p-2',
  rowBetween: 'flex items-start justify-between gap-2 rounded-md bg-dnd-obsidian-raised/50 p-3',
  linkBtn: 'mt-2 inline-flex items-center gap-1 font-ui text-sm text-dnd-gold transition hover:text-dnd-ember',
  loader: 'h-8 w-8 animate-spin text-dnd-gold',
  empty: 'py-4 text-center font-narrative text-sm italic text-dnd-parchment-muted',
  pickerPanel: 'grid max-h-48 grid-cols-1 gap-2 overflow-y-auto rounded-md border border-dnd-gold/15 bg-dnd-obsidian/80 p-2 sm:grid-cols-2',
  pickerItem: 'flex cursor-pointer items-center gap-3 rounded p-2 transition hover:bg-dnd-mist',
  pickerItemSelected: 'flex cursor-pointer items-center gap-3 rounded bg-dnd-gold/15 p-2',
} as const;

/** Tile de seleção múltipla (perícias, proficiências, etc.) */
export function hbTileClass(selected: boolean): string {
  return selected ? hb.tileSelected : hb.tile;
}

/** Chip toggle (tipos de dano, condições, etc.) */
export function hbChipClass(selected: boolean): string {
  return selected ? hb.chipSelected : hb.chip;
}
