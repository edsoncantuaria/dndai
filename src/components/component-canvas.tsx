'use client';

import { useState } from 'react';
import type { CanvasComponent, CanvasComponentType } from '@/lib/types';
import { ComponentPalette } from '@/components/component-palette';
import { CodeGenerator } from '@/components/code-generator';
import { CanvasArea } from '@/components/canvas-area';
import { Separator } from '@/components/ui/separator';
import { Header } from '@/components/header';
import { Button } from './ui/button';

export function ComponentCanvas() {
  const [components, setComponents] = useState<CanvasComponent[]>([]);

  const handleDrop = (
    item: { type: string; id?: string },
    x: number,
    y: number,
    offsetX: number = 0,
    offsetY: number = 0
  ) => {
    if (item.id) {
      // Repositioning
      setComponents((prev) =>
        prev.map((c) =>
          c.id === item.id
            ? { ...c, props: { ...c.props, style: { ...c.props.style, top: y - offsetY, left: x - offsetX } } }
            : c
        )
      );
    } else {
      // New component
      const newComponent: CanvasComponent = {
        id: `comp_${Date.now()}`,
        type: item.type as CanvasComponentType,
        props: {
          style: {
            top: y,
            left: x,
            width: item.type === 'Card' ? 200 : 120,
            height: item.type === 'Card' ? 150 : 40,
          },
        },
      };
      setComponents((prev) => [...prev, newComponent]);
    }
  };

  const handleClearCanvas = () => {
    setComponents([]);
  };

  return (
    <div className="flex h-dvh bg-background text-foreground">
      <aside className="w-80 h-full bg-card border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-2xl font-bold font-headline">Component Canvas</h1>
        </div>
        <div className="flex-grow overflow-y-auto">
          <ComponentPalette />
          <Separator className="my-2" />
          <CodeGenerator components={components} />
        </div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header onClear={handleClearCanvas} />
        <div className="flex-1 p-4 lg:p-6 overflow-auto">
          <CanvasArea components={components} onDrop={handleDrop} />
        </div>
      </main>
    </div>
  );
}
