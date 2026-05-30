'use client';

import type { LucideIcon } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';
import { AmbientBackground, DndDivider } from '@/components/primitives';
import { cn } from '@/lib/utils';

export interface HubLayoutProps {
  title: string;
  subtitle?: string;
  label?: string;
  variant?: 'home' | 'default';
  onBack?: () => void;
  backLabel?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function HubLayout({
  title,
  subtitle,
  label,
  variant = 'default',
  onBack,
  backLabel = 'Voltar',
  headerActions,
  children,
  className,
}: HubLayoutProps) {
  const isHome = variant === 'home';

  return (
    <div className={cn('relative h-full min-h-0 w-full overflow-x-hidden overflow-y-auto bg-dnd-obsidian', className)}>
      <AmbientBackground variant="cinematic" showVignette={isHome} />
      <div className="dnd-film-grain pointer-events-none fixed inset-0 z-[1] opacity-[0.035]" aria-hidden />
      <div className="relative z-10 mx-auto max-w-screen-xl px-4 pb-16 pt-[calc(1.25rem+var(--dnd-safe-top))] sm:px-6">
        <header
          className={cn(
            'dnd-hero-stage border-b border-dnd-gold/10',
            isHome ? 'mb-8 pb-6' : 'mb-10 pb-8',
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="mb-4 inline-flex items-center gap-1.5 font-ui text-sm text-dnd-parchment-muted transition hover:text-dnd-gold"
                >
                  <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                  {backLabel}
                </button>
              ) : null}
              {label ? (
                <>
                  <div className="dnd-brand-accent mb-3" aria-hidden />
                  <p className="font-ui text-[11px] font-bold uppercase tracking-[0.28em] text-dnd-ember">
                    {label}
                  </p>
                </>
              ) : (
                <div className="dnd-brand-accent mb-3" aria-hidden />
              )}
              <h1
                className={cn(
                  'font-display leading-[1.05] tracking-tight text-dnd-parchment',
                  isHome
                    ? 'mt-2 text-3xl drop-shadow-[0_2px_20px_rgba(0,0,0,0.65)] sm:text-4xl lg:text-5xl'
                    : cn('text-4xl sm:text-5xl lg:text-[3.25rem]', label ? 'mt-2' : 'mt-1'),
                )}
              >
                <span className="dnd-text-gradient-gold">{title}</span>
              </h1>
              {subtitle ? (
                <p
                  className={cn(
                    'max-w-lg font-narrative leading-relaxed text-dnd-parchment-muted',
                    isHome ? 'mt-3 text-base' : 'mt-3 text-[0.95rem]',
                  )}
                >
                  {subtitle}
                </p>
              ) : null}
            </div>
            {headerActions ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">{headerActions}</div>
            ) : null}
          </div>
          {isHome ? <DndDivider className="mt-6 opacity-70" /> : null}
        </header>
        {children}
      </div>
    </div>
  );
}

export function HubFooterActions({ children }: { children: React.ReactNode }) {
  return (
    <footer className="mt-10 flex flex-wrap gap-2 border-t border-dnd-gold/15 pt-6">{children}</footer>
  );
}

export type HubStatPillVariant = 'card' | 'inline';

export function HubQuickStat({
  icon: Icon,
  label,
  value,
  onClick,
  active,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  onClick: () => void;
  active?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'dnd-hub-stat group flex min-h-[88px] flex-col items-center justify-center gap-1.5 px-2 py-3.5 text-center',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dnd-gold/30',
        'hover:-translate-y-0.5 hover:border-dnd-gold/30',
        (active || accent) && 'dnd-hub-stat-active',
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-dnd-gold/20 bg-dnd-mist/30 text-dnd-gold transition group-hover:border-dnd-gold/35 group-hover:bg-dnd-gold/10">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="font-display text-xl tabular-nums leading-none text-dnd-gold drop-shadow-sm">{value}</span>
      <span className="font-ui text-[9px] uppercase tracking-[0.18em] text-dnd-parchment-muted">{label}</span>
    </button>
  );
}

export function HubStatPill({
  label,
  value,
  variant = 'card',
}: {
  label: string;
  value: string | number;
  variant?: HubStatPillVariant;
}) {
  if (variant === 'inline') {
    return (
      <div className="inline-flex items-baseline gap-2 rounded-full border border-dnd-gold/15 bg-dnd-obsidian-raised/60 px-3.5 py-1.5">
        <span className="font-ui text-[11px] uppercase tracking-wider text-dnd-parchment-muted">{label}</span>
        <span className="font-display text-lg tabular-nums leading-none text-dnd-gold">{value}</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dnd-gold/12 bg-dnd-obsidian-raised/50 px-4 py-3.5">
      <p className="font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums leading-none text-dnd-gold">{value}</p>
    </div>
  );
}

/** Select nativo com aparência alinhada ao design system v2 */
export const hubSelectClassName =
  'w-full min-h-[44px] appearance-none rounded-xl border border-dnd-gold/15 bg-dnd-obsidian-raised/90 px-3.5 font-ui text-sm text-dnd-parchment shadow-sm transition focus:border-dnd-gold/40 focus:outline-none focus:ring-2 focus:ring-dnd-gold/15';

export function HubSectionHeader({
  title,
  action,
  className,
  ornate = true,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
  ornate?: boolean;
}) {
  return (
    <div className={cn('mb-5', className)}>
      {ornate ? <DndDivider className="mb-4 opacity-75" /> : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-xl tracking-wide text-dnd-gold sm:text-2xl">{title}</h2>
        {action}
      </div>
    </div>
  );
}

export type HubNavCardAccent = 'gold' | 'ember' | 'cyan';

export function HubNavCard({
  icon,
  title,
  description,
  onClick,
  accent = 'gold',
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  accent?: HubNavCardAccent;
  badge?: string;
}) {
  const accentRing =
    accent === 'cyan'
      ? 'group-hover:border-cyan-400/35 group-hover:shadow-[0_0_24px_-8px_rgba(34,211,238,0.25)]'
      : accent === 'ember'
        ? 'group-hover:border-dnd-ember/40 group-hover:shadow-[0_0_28px_-6px_var(--dnd-ember-glow)]'
        : 'group-hover:border-dnd-gold/35 group-hover:shadow-[0_0_28px_-8px_var(--dnd-gold-glow)]';

  const iconBg =
    accent === 'cyan'
      ? 'bg-cyan-500/10 text-cyan-300/90 group-hover:bg-cyan-500/15'
      : accent === 'ember'
        ? 'bg-dnd-ember/15 text-dnd-ember group-hover:bg-dnd-ember/20'
        : 'bg-dnd-gold/10 text-dnd-gold group-hover:bg-dnd-gold/15';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group dnd-ornate-corners relative flex min-h-[132px] flex-col rounded-2xl border border-dnd-gold/14 bg-dnd-obsidian-raised/50 p-5 text-left transition duration-200',
        'shadow-[var(--dnd-shadow-card)] hover:-translate-y-0.5 hover:bg-dnd-obsidian-raised/75',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dnd-gold/25',
        accentRing,
      )}
    >
      <span className="dnd-corner dnd-corner-tl" aria-hidden />
      <span className="dnd-corner dnd-corner-tr" aria-hidden />
      <span className="dnd-corner dnd-corner-bl" aria-hidden />
      <span className="dnd-corner dnd-corner-br" aria-hidden />
      <span className={cn('mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-dnd-gold/15 transition', iconBg)}>
        {icon}
      </span>
      <span className="flex items-center gap-2">
        <span className="font-display text-base leading-snug text-dnd-parchment">{title}</span>
        {badge ? (
          <span className="rounded bg-dnd-gold/15 px-1.5 py-0.5 font-ui text-[9px] font-bold uppercase tracking-wider text-dnd-gold">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="mt-1.5 font-narrative text-xs leading-relaxed text-dnd-parchment-muted">{description}</span>
    </button>
  );
}
