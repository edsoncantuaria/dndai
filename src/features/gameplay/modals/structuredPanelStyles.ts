import { cn } from '@/lib/utils';

export function structuredPanelFormClass(variant: 'legacy' | 'v2' = 'legacy') {
  return variant === 'v2'
    ? 'space-y-2'
    : 'space-y-2 rounded-2xl border border-white/10 bg-black/30 p-3';
}

export function structuredPanelTitleClass(variant: 'legacy' | 'v2' = 'legacy') {
  return cn(
    'text-xs font-semibold uppercase tracking-wide',
    variant === 'v2' ? 'font-ui text-dnd-gold' : 'text-amber-300'
  );
}

export function structuredFieldClass(variant: 'legacy' | 'v2' = 'legacy') {
  return variant === 'v2'
    ? 'mt-1 w-full min-h-[44px] rounded-md border border-dnd-gold/25 bg-dnd-obsidian-raised/90 px-3 py-2 font-ui text-sm text-dnd-parchment'
    : 'mt-1 w-full rounded-xl border border-white/15 bg-black/40 p-2 text-stone-100';
}

export function structuredLabelClass(variant: 'legacy' | 'v2' = 'legacy') {
  return variant === 'v2' ? 'flex-1 font-ui text-sm text-dnd-parchment' : 'flex-1 text-sm text-stone-300';
}
