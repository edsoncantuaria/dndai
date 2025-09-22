'use client';

import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

export function Header({ onClear }: { onClear: () => void }) {
  return (
    <header className="flex items-center justify-between p-4 border-b bg-card z-10">
      <div></div>
      <div>
        <Button variant="outline" onClick={onClear}>
          <Trash2 className="mr-2 h-4 w-4" />
          Clear Canvas
        </Button>
      </div>
    </header>
  );
}
