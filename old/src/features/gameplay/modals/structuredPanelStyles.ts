/** V3-only — o parâmetro `variant` é ignorado (compatibilidade com chamadas antigas). */
type _LegacyVariant = 'legacy' | 'v2';

export function structuredPanelFormClass(_variant?: _LegacyVariant) {
  return 'space-y-2';
}

export function structuredPanelTitleClass(_variant?: _LegacyVariant) {
  return 'font-ui text-xs font-semibold uppercase tracking-wide text-dnd-gold';
}

export function structuredFieldClass(_variant?: _LegacyVariant) {
  return 'mt-1 w-full min-h-[44px] rounded-md border border-dnd-gold/25 bg-dnd-obsidian-raised/90 px-3 py-2 font-ui text-sm text-dnd-parchment';
}

export function structuredLabelClass(_variant?: _LegacyVariant) {
  return 'flex-1 font-ui text-sm text-dnd-parchment';
}
