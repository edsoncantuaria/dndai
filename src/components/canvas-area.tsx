'use client';

import type { CanvasComponent } from '@/lib/types';
import { CanvasItem } from './canvas-item';

type CanvasAreaProps = {
  components: CanvasComponent[];
  onDrop: (item: { type: string; id?: string }, x: number, y: number, offsetX?: number, offsetY?: number) => void;
};

export function CanvasArea({ components, onDrop }: CanvasAreaProps) {
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const componentType = e.dataTransfer.getData('componentType');
    const componentId = e.dataTransfer.getData('componentId');
    const canvasRect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - canvasRect.left;
    const y = e.clientY - canvasRect.top;

    if (componentId) {
      // Repositioning existing component
      const offsetX = parseFloat(e.dataTransfer.getData('offsetX'));
      const offsetY = parseFloat(e.dataTransfer.getData('offsetY'));
      onDrop({ type: 'reposition', id: componentId }, x, y, offsetX, offsetY);
    } else if (componentType) {
      // Dropping new component
      onDrop({ type: componentType }, x, y);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative w-full h-full bg-card rounded-lg shadow-sm border"
      style={{ minHeight: 'calc(100dvh - 120px)' }}
      aria-label="Component canvas"
    >
      {components.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-muted-foreground">Drag components here to start building</p>
        </div>
      )}
      {components.map((comp) => (
        <CanvasItem key={comp.id} component={comp} />
      ))}
    </div>
  );
}
