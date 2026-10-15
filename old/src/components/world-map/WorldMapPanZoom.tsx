'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WorldMapPanZoomProps {
  width: number;
  height: number;
  className?: string;
  /** Centraliza o zoom neste ponto do canvas (ex.: posição do jogador). */
  focusPoint?: { x: number; y: number } | null;
  /** Multiplicador sobre o zoom "fit" quando há focusPoint (default 1.65). */
  focusZoom?: number;
  children: React.ReactNode;
}

export function WorldMapPanZoom({
  width,
  height,
  className,
  focusPoint,
  focusZoom = 1.65,
  children,
}: WorldMapPanZoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const fitView = useCallback(
    (mode: 'full' | 'focus' = focusPoint ? 'focus' : 'full') => {
      const el = containerRef.current;
      if (!el || width <= 0 || height <= 0) return;
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (!cw || !ch) return;

      const fit = Math.min(cw / width, ch / height);
      const nextScale =
        mode === 'focus' && focusPoint ? fit * focusZoom : fit * 0.98;

      if (mode === 'focus' && focusPoint) {
        setScale(nextScale);
        setPan({
          x: cw / 2 - focusPoint.x * nextScale,
          y: ch / 2 - focusPoint.y * nextScale,
        });
        return;
      }

      setScale(nextScale);
      setPan({
        x: (cw - width * nextScale) / 2,
        y: (ch - height * nextScale) / 2,
      });
    },
    [width, height, focusPoint, focusZoom],
  );

  useEffect(() => {
    fitView(focusPoint ? 'focus' : 'full');
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => fitView(focusPoint ? 'focus' : 'full'));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitView, focusPoint]);

  const zoomAtCenter = useCallback((factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    setScale(prevScale => {
      const nextScale = Math.min(3.5, Math.max(0.25, prevScale * factor));
      const ratio = nextScale / prevScale;
      setPan(prevPan => ({
        x: cx - (cx - prevPan.x) * ratio,
        y: cy - (cy - prevPan.y) * ratio,
      }));
      return nextScale;
    });
  }, []);

  const stopControlEvent = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setScale(prevScale => {
      const nextScale = Math.min(3.5, Math.max(0.25, prevScale * factor));
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
    if ((e.target as HTMLElement).closest('[data-map-control]')) return;
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

  const controlClass =
    'flex h-10 w-10 items-center justify-center rounded-lg border border-dnd-gold/40 bg-[#0f172a]/95 text-dnd-parchment shadow-lg backdrop-blur-sm transition hover:border-dnd-gold/70 hover:bg-[#1e293b] active:scale-95';

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        ref={containerRef}
        className="relative h-[min(70vh,620px)] min-h-[280px] w-full touch-none overflow-hidden rounded-xl border border-dnd-gold/20 bg-[#0a1219] shadow-inner"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          data-map-control
          className="absolute right-2 top-2 z-20 flex flex-col gap-1.5"
          onPointerDown={stopControlEvent}
          onPointerMove={stopControlEvent}
          onPointerUp={stopControlEvent}
        >
          <button
            type="button"
            data-map-control
            onClick={e => {
              e.stopPropagation();
              zoomAtCenter(1.2);
            }}
            className={controlClass}
            aria-label="Aumentar zoom"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            data-map-control
            onClick={e => {
              e.stopPropagation();
              zoomAtCenter(1 / 1.2);
            }}
            className={controlClass}
            aria-label="Diminuir zoom"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            data-map-control
            onClick={e => {
              e.stopPropagation();
              fitView(focusPoint ? 'focus' : 'full');
            }}
            className={controlClass}
            aria-label={focusPoint ? 'Centralizar em você' : 'Ver continente inteiro'}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
        <div
          className="absolute left-0 top-0 origin-top-left will-change-transform"
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
        Arraste para mover · scroll ou botões para zoom · ↺ recentraliza em você
      </p>
    </div>
  );
}
