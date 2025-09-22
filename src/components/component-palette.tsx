'use client';
import { LayoutDashboard, RectangleHorizontal, TextCursorInput } from 'lucide-react';
import type { CanvasComponentType } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const paletteItems: { type: CanvasComponentType; icon: React.ReactNode; label: string }[] = [
  { type: 'Button', icon: <RectangleHorizontal className="h-5 w-5" />, label: 'Button' },
  { type: 'Input', icon: <TextCursorInput className="h-5 w-5" />, label: 'Input' },
  { type: 'Card', icon: <LayoutDashboard className="h-5 w-5" />, label: 'Card' },
];

const DraggableItem = ({ type, icon, label }: { type: CanvasComponentType; icon: React.ReactNode; label: string }) => {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('componentType', type);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex items-center gap-3 p-2 rounded-md border bg-card hover:bg-accent hover:text-accent-foreground cursor-grab active:cursor-grabbing transition-colors"
      role="button"
      aria-label={`Drag ${label} component`}
    >
      {icon}
      <span className="font-medium text-sm">{label}</span>
    </div>
  );
};

export function ComponentPalette() {
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4 px-2">Components</h2>
      <div className="flex flex-col gap-2">
        {paletteItems.map((item) => (
          <DraggableItem key={item.type} {...item} />
        ))}
      </div>
    </div>
  );
}
