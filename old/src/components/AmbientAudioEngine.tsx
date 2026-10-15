'use client';

import { useAmbientTrackPlayer } from '@/hooks/useAmbientTrackPlayer';

/** Motor de áudio ambiente sem UI — uma instância global no GameContainer (UI v2). */
export function AmbientAudioEngine() {
  const { audioRef } = useAmbientTrackPlayer();
  return <audio ref={audioRef} loop className="hidden" aria-hidden />;
}
