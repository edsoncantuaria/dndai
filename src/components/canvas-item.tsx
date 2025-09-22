'use client';

import type { CanvasComponent } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { memo } from 'react';

const componentMap = {
  Button: ({ component }: { component: CanvasComponent }) => (
    <Button variant="outline" className="w-full h-full pointer-events-none">
      {component.props.text || 'Button'}
    </Button>
  ),
  Input: ({ component }: { component: CanvasComponent }) => (
    <Input className="w-full h-full pointer-events-none" placeholder="Input Field" />
  ),
  Card: ({ component }: { component: CanvasComponent }) => (
    <Card className="w-full h-full pointer-events-none flex items-center justify-center">
      <span className="text-muted-foreground text-sm">Card</span>
    </Card>
  ),
};

const CanvasItemComponent = ({ component }: { component: CanvasComponent }) => {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.dataTransfer.setData('componentId', component.id);
    const target = e.currentTarget as HTMLDivElement;
    e.dataTransfer.setData('offsetX', (e.clientX - target.getBoundingClientRect().left).toString());
    e.dataTransfer.setData('offsetY', (e.clientY - target.getBoundingClientRect().top).toString());
  };

  const ComponentToRender = componentMap[component.type];

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      style={{ ...component.props.style, position: 'absolute' }}
      className="border-2 border-transparent hover:border-dashed hover:border-primary rounded-md cursor-move focus-within:border-primary focus-within:border-solid"
      aria-label={`${component.type} component`}
    >
      <ComponentToRender component={component} />
    </div>
  );
};

export const CanvasItem = memo(CanvasItemComponent);
