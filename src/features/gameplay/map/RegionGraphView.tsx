'use client';

import { useMemo, useRef, useState, useCallback } from 'react';
import { MapPin, Lock } from 'lucide-react';
import type { WorldMapSnapshot } from '@/services/gameService';
import type { RegionDTO } from '@/services/regionClient';
import { buildRegionHierarchy, computeHierarchyLayout } from '@/utils/regionTree';
import { cn } from '@/lib/utils';

const NODE_W = 100;
const NODE_H = 44;

export function RegionGraphView({
  snapshot,
  className,
}: {
  snapshot: WorldMapSnapshot | null;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const layout = useMemo(() => {
    if (!snapshot?.regions?.length) return null;
    const regionsAsDto = snapshot.regions as RegionDTO[];
    const roots = buildRegionHierarchy(regionsAsDto);
    const positions = computeHierarchyLayout(roots);
    const coords = Object.values(positions);
    let maxX = 0;
    let maxY = 0;
    for (const pos of coords) {
      maxX = Math.max(maxX, pos.x);
      maxY = Math.max(maxY, pos.y);
    }
    const links = Array.isArray(snapshot.links) ? snapshot.links : [];
    return {
      positions,
      roots,
      width: Math.max(maxX + NODE_W + 40, NODE_W + 40),
      height: Math.max(maxY + NODE_H + 40, NODE_H + 40),
      links,
    };
  }, [snapshot]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(2, Math.max(0.5, s - e.deltaY * 0.001)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPan({
      x: dragRef.current.panX + (e.clientX - dragRef.current.x),
      y: dragRef.current.panY + (e.clientY - dragRef.current.y),
    });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  if (!layout) {
    return (
      <p className="py-8 text-center font-ui text-sm text-dnd-parchment-muted">
        Nenhuma região mapeada nesta sessão.
      </p>
    );
  }

  const { positions, width, height, links } = layout;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative h-[220px] overflow-hidden rounded-lg border border-dnd-gold/15 bg-dnd-obsidian touch-none',
        className
      )}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div
        className="origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          width,
          height,
        }}
      >
        <svg className="pointer-events-none absolute inset-0" width={width} height={height}>
          {links.map((link, i) => {
            const from = positions[link.fromSlug];
            const to = positions[link.toSlug];
            if (!from || !to) return null;
            const discovered = link.discovered && !link.isLocked;
            return (
              <line
                key={`${link.fromSlug}-${link.toSlug}-${i}`}
                x1={from.x + NODE_W / 2}
                y1={from.y + NODE_H / 2}
                x2={to.x + NODE_W / 2}
                y2={to.y + NODE_H / 2}
                stroke={discovered ? 'var(--dnd-gold)' : 'var(--dnd-parchment-muted)'}
                strokeOpacity={discovered ? 0.5 : 0.2}
                strokeWidth={discovered ? 2 : 1}
                strokeDasharray={link.isLocked ? '4 4' : undefined}
              />
            );
          })}
        </svg>

        {snapshot?.regions.map((region) => {
          const pos = positions[region.slug];
          if (!pos) return null;
          const isCurrent = region.isCurrent || snapshot.currentRegionSlug === region.slug;
          const undiscovered = region.isDiscovered === false;

          return (
            <div
              key={region.slug}
              className={cn(
                'absolute flex flex-col items-center justify-center rounded-md border px-1 py-1 text-center transition-shadow',
                isCurrent
                  ? 'animate-pulse border-dnd-gold bg-dnd-gold/15 shadow-[0_0_12px_var(--dnd-gold-glow)]'
                  : undiscovered
                    ? 'border-dnd-parchment-muted/20 bg-dnd-obsidian-raised/40 opacity-50'
                    : 'border-dnd-gold/25 bg-dnd-obsidian-raised/80'
              )}
              style={{ left: pos.x, top: pos.y, width: NODE_W, minHeight: NODE_H }}
              title={region.summary ?? region.name}
            >
              {undiscovered ? (
                <Lock className="h-3 w-3 text-dnd-parchment-muted" />
              ) : (
                <MapPin className={cn('h-3 w-3', isCurrent ? 'text-dnd-gold' : 'text-dnd-parchment-muted')} />
              )}
              <span className="mt-0.5 line-clamp-2 font-ui text-[9px] leading-tight text-dnd-parchment">
                {undiscovered ? '???' : region.name}
              </span>
              {region.pointsOfInterest?.length ? (
                <span className="font-ui text-[8px] text-dnd-parchment-muted">
                  {region.pointsOfInterest.filter((p) => p.isDiscovered !== false).length}/
                  {region.pointsOfInterest.length} POI
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="pointer-events-none absolute bottom-1 right-2 font-ui text-[9px] text-dnd-parchment-muted/70">
        Arraste · scroll para zoom
      </p>
    </div>
  );
}
