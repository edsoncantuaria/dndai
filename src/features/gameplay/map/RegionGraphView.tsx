'use client';

import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { MapPin, Lock } from 'lucide-react';
import type { WorldMapSnapshot } from '@/services/gameService';
import {
  REGION_GRAPH_NODE_H,
  REGION_GRAPH_NODE_W,
  buildRegionGraphLayout,
  fitRegionGraphView,
} from '@/utils/regionGraphLayout';
import { cn } from '@/lib/utils';

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

  const layout = useMemo(() => buildRegionGraphLayout(snapshot), [snapshot]);

  const applyFit = useCallback(() => {
    const el = containerRef.current;
    if (!el || !layout) return;
    const { scale: nextScale, pan: nextPan } = fitRegionGraphView(
      el.clientWidth,
      el.clientHeight,
      layout,
    );
    setScale(nextScale);
    setPan(nextPan);
  }, [layout]);

  useEffect(() => {
    applyFit();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => applyFit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [applyFit]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setScale(prevScale => {
      const nextScale = Math.min(2.5, Math.max(0.35, prevScale * factor));
      const ratio = nextScale / prevScale;
      setPan(prevPan => ({
        x: cx - (cx - prevPan.x) * ratio,
        y: cy - (cy - prevPan.y) * ratio,
      }));
      return nextScale;
    });
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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

  const { positions, width, height, links, regions } = layout;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative h-[220px] overflow-hidden rounded-lg border border-dnd-gold/15 bg-[#0a1219] touch-none',
        className,
      )}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onDoubleClick={applyFit}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
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
            const highlighted =
              link.fromCurrent ||
              link.fromSlug === snapshot?.currentRegionSlug ||
              link.toSlug === snapshot?.currentRegionSlug;
            const discovered = (link.discovered || link.reachable) && !link.isLocked;
            return (
              <line
                key={`${link.fromSlug}-${link.toSlug}-${i}`}
                x1={from.x + REGION_GRAPH_NODE_W / 2}
                y1={from.y + REGION_GRAPH_NODE_H / 2}
                x2={to.x + REGION_GRAPH_NODE_W / 2}
                y2={to.y + REGION_GRAPH_NODE_H / 2}
                stroke={discovered ? '#fcd34d' : '#64748b'}
                strokeOpacity={highlighted ? 0.75 : discovered ? 0.45 : 0.25}
                strokeWidth={highlighted ? 2.5 : 1.5}
                strokeDasharray={link.isLocked ? '4 4' : undefined}
              />
            );
          })}
        </svg>

        {regions.map(region => {
          const pos = positions[region.slug];
          if (!pos) return null;
          const isCurrent = region.isCurrent || snapshot?.currentRegionSlug === region.slug;
          const undiscovered = region.isDiscovered === false && !isCurrent;

          return (
            <div
              key={region.slug}
              className={cn(
                'absolute flex flex-col items-center justify-center rounded-md border px-1 py-1 text-center transition-shadow',
                isCurrent
                  ? 'border-dnd-gold bg-dnd-gold/20 shadow-[0_0_14px_rgba(250,204,21,0.35)]'
                  : undiscovered
                    ? 'border-dnd-parchment-muted/20 bg-dnd-obsidian-raised/40 opacity-50'
                    : 'border-dnd-gold/30 bg-dnd-obsidian-raised/90',
              )}
              style={{ left: pos.x, top: pos.y, width: REGION_GRAPH_NODE_W, minHeight: REGION_GRAPH_NODE_H }}
              title={region.summary ?? region.name}
            >
              {undiscovered ? (
                <Lock className="h-3 w-3 text-dnd-parchment-muted" />
              ) : (
                <MapPin className={cn('h-3 w-3', isCurrent ? 'text-dnd-gold' : 'text-dnd-parchment-muted')} />
              )}
              <span
                className={cn(
                  'mt-0.5 line-clamp-2 font-ui text-[9px] leading-tight',
                  isCurrent ? 'font-semibold text-dnd-gold' : 'text-dnd-parchment',
                )}
              >
                {undiscovered ? '???' : region.name}
              </span>
              {region.pointsOfInterest?.length ? (
                <span className="font-ui text-[8px] text-dnd-parchment-muted">
                  {region.pointsOfInterest.filter(p => p.isDiscovered !== false).length}/
                  {region.pointsOfInterest.length} POI
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="pointer-events-none absolute bottom-1 right-2 font-ui text-[9px] text-dnd-parchment-muted/70">
        Arraste · scroll · duplo clique para encaixar
      </p>
    </div>
  );
}
