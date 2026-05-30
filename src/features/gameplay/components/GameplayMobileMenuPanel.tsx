'use client';

import { Download, Map, Settings, Terminal, Volume2, VolumeX } from 'lucide-react';
import { DndButton, DndCard } from '@/components/primitives';
import { GameplayMaisSheetSection } from './GameplayMaisSheetSection';
import { CampanhaPanel } from '../campaign/CampanhaPanel';
import { isDebugWsEnabled } from '@/lib/debugFlags';

export interface GameplayMobileMenuPanelProps {
  sessionId?: number | null;
  onOpenWorldMap?: () => void;
  onOpenSettings?: () => void;
  onNarrationToggle?: () => void;
  isNarrationActive?: boolean;
  onOpenSessionLog?: () => void;
  onExitSession: () => void;
}

export function GameplayMobileMenuPanel({
  sessionId,
  onOpenWorldMap,
  onOpenSettings,
  onNarrationToggle,
  isNarrationActive,
  onOpenSessionLog,
  onExitSession,
}: GameplayMobileMenuPanelProps) {
  const showDebugLog = isDebugWsEnabled() && onOpenSessionLog;

  return (
    <div className="space-y-4 p-1">
      <DndCard padding="md" hover={false}>
        <p className="font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">Mais</p>
        <h3 className="mt-1 font-display text-lg text-dnd-parchment">Sua aventura</h3>
        <div className="mt-4 flex flex-col gap-2">
          {onOpenWorldMap ? (
            <DndButton variant="goldOutline" className="w-full justify-start" onClick={onOpenWorldMap}>
              <Map className="h-4 w-4" />
              Mapa mundi
            </DndButton>
          ) : null}
          {onNarrationToggle ? (
            <DndButton variant="ghost" className="w-full justify-start" onClick={onNarrationToggle}>
              {isNarrationActive ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              {isNarrationActive ? 'Parar narração' : 'Ouvir narração'}
            </DndButton>
          ) : null}
          {onOpenSettings ? (
            <DndButton variant="ghost" className="w-full justify-start" onClick={onOpenSettings}>
              <Settings className="h-4 w-4" />
              Configurações
            </DndButton>
          ) : null}
          {showDebugLog ? (
            <DndButton variant="ghost" className="w-full justify-start" onClick={onOpenSessionLog}>
              <Terminal className="h-4 w-4" />
              Registro técnico (dev)
            </DndButton>
          ) : null}
          <DndButton variant="ember" className="w-full justify-start" onClick={onExitSession}>
            <Download className="h-4 w-4 rotate-180" />
            Sair da sessão
          </DndButton>
        </div>
      </DndCard>

      <DndCard padding="md" hover={false}>
        <GameplayMaisSheetSection />
      </DndCard>

      <DndCard padding="md" hover={false}>
        <p className="mb-3 font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">Campanha</p>
        <CampanhaPanel
          sessionId={sessionId ?? null}
          onOpenMap={onOpenWorldMap ? () => onOpenWorldMap() : undefined}
        />
      </DndCard>
    </div>
  );
}
