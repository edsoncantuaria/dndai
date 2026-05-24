'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WorldMapPanZoomProps {
  width: number;
  height: number;
  className?: string;
  children: React.ReactNode;
}

export function WorldMapPanZoom({ width, height, className, children }: WorldMapPanZoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const fitView = useCallback(() => {
    const el = containerRef.current;
    if (!el || width <= 0 || height <= 0) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    if (!cw || !ch) return;
    const fit = Math.min(cw / width, ch / height) * 0.9;
    setScale(fit);
    setPan({
      x: (cw - width * fit) / 2,
      y: Math.max(8, (ch - height * fit) / 2),
    });
  }, [width, height]);

  useEffect(() => {
    fitView();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => fitView());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitView]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setScale((s) => Math.min(2.5, Math.max(0.15, s - e.deltaY * 0.0012)));
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

  const zoomBy = (factor: number) => {
    setScale((s) => Math.min(2.5, Math.max(0.15, s * factor)));
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        ref={containerRef}
        className="relative h-[min(52vh,480px)] min-h-[240px] w-full touch-none overflow-hidden rounded-xl border border-dnd-gold/20 bg-dnd-obsidian"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => zoomBy(1.2)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-dnd-gold/25 bg-dnd-obsidian-raised/95 text-dnd-parchment shadow-md"
            aria-label="Aumentar zoom"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.2)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-dnd-gold/25 bg-dnd-obsidian-raised/95 text-dnd-parchment shadow-md"
            aria-label="Diminuir zoom"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={fitView}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-dnd-gold/25 bg-dnd-obsidian-raised/95 text-dnd-parchment shadow-md"
            aria-label="Centralizar mapa"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width,
            height,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          }}
        >
          {children}
        </div>
      </div>
      <p className="font-ui text-[11px] text-dnd-parchment-muted">
        Arraste para mover · scroll ou botões para zoom
      </p>
    </div>
  );
}
