'use client';

import { ArrowLeft } from 'lucide-react';
import { AmbientBackground } from '@/components/primitives';
import { cn } from '@/lib/utils';

export interface HubLayoutProps {
  title: string;
  subtitle?: string;
  label?: string;
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
  onBack,
  backLabel = 'Voltar',
  headerActions,
  children,
  className,
}: HubLayoutProps) {
  return (
    <div className={cn('relative min-h-full w-full overflow-x-hidden overflow-y-auto bg-dnd-obsidian', className)}>
      <AmbientBackground variant="ember" showVignette={false} />
      <div className="relative z-10 mx-auto max-w-screen-xl px-4 pb-16 pt-[calc(1rem+var(--dnd-safe-top))] sm:px-6">
        <header className="mb-8 border-b border-dnd-gold/12 pb-6">
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
                <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.22em] text-dnd-gold/80">
                  {label}
                </p>
              ) : null}
              <h1
                className={cn(
                  'font-display text-3xl leading-tight tracking-tight text-dnd-parchment sm:text-[2rem]',
                  label ? 'mt-1' : undefined
                )}
              >
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-3 max-w-lg font-narrative text-[0.95rem] leading-relaxed text-dnd-parchment-muted">
                  {subtitle}
                </p>
              ) : null}
            </div>
            {headerActions ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">{headerActions}</div>
            ) : null}
          </div>
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
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-end justify-between gap-3', className)}>
      <h2 className="font-display text-lg text-dnd-parchment">{title}</h2>
      {action}
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
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  accent?: HubNavCardAccent;
}) {
  const accentRing =
    accent === 'cyan'
      ? 'group-hover:border-cyan-400/35 group-hover:shadow-[0_0_24px_-8px_rgba(34,211,238,0.25)]'
      : accent === 'ember'
        ? 'group-hover:border-dnd-ember/35 group-hover:shadow-[0_0_24px_-8px_rgba(196,30,58,0.2)]'
        : 'group-hover:border-dnd-gold/30 group-hover:shadow-[0_0_24px_-8px_rgba(201,162,39,0.15)]';

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
        'group flex min-h-[120px] flex-col rounded-2xl border border-dnd-gold/12 bg-dnd-obsidian-raised/40 p-4 text-left transition duration-200',
        'hover:bg-dnd-obsidian-raised/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dnd-gold/25',
        accentRing
      )}
    >
      <span className={cn('mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl transition', iconBg)}>
        {icon}
      </span>
      <span className="font-display text-base leading-snug text-dnd-parchment">{title}</span>
      <span className="mt-1 font-ui text-xs leading-relaxed text-dnd-parchment-muted">{description}</span>
    </button>
  );
}
