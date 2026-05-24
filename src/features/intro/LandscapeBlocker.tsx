'use client';

import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { DndHeading } from '@/components/primitives';

/** Mensagem estilo Intro Experience quando mobile está em landscape */
export function LandscapeBlocker() {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const check = () => {
      const isMobile = window.matchMedia('(max-width: 767px)').matches;
      const isLandscape = window.matchMedia('(orientation: landscape)').matches;
      setBlocked(isMobile && isLandscape);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  if (!blocked) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-dnd-obsidian px-8 text-center">
      <Smartphone className="mb-6 h-16 w-16 animate-pulse text-dnd-gold" />
      <DndHeading variant="section" className="mb-2">
        Gire seu dispositivo
      </DndHeading>
      <p className="font-narrative text-dnd-parchment-muted">
        A mesa foi forjada para aventuras em pé — volte ao modo retrato para continuar.
      </p>
    </div>
  );
}
