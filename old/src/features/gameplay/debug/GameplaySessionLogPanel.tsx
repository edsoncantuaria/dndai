'use client';

import { useEffect, useState } from 'react';
import { Terminal, Trash2 } from 'lucide-react';
import { DndCard } from '@/components/primitives';
import {
  clearSessionDebugEvents,
  formatSessionDebugEvent,
  getSessionDebugEvents,
  subscribeSessionDebugEvents,
  type SessionDebugEvent,
} from '@/lib/sessionDebugStore';

export function GameplaySessionLogPanel({ sessionId }: { sessionId: number | null }) {
  const [events, setEvents] = useState<SessionDebugEvent[]>(() => getSessionDebugEvents());

  useEffect(() => {
    return subscribeSessionDebugEvents(() => setEvents(getSessionDebugEvents()));
  }, []);

  return (
    <div className="space-y-4">
      <DndCard padding="md" hover={false}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-ui text-[10px] uppercase tracking-wider text-dnd-gold">
              <Terminal className="h-4 w-4" />
              Registro da sessão
            </p>
            <h3 className="mt-1 font-display text-lg text-dnd-parchment">WebSocket & pipeline</h3>
            <p className="mt-1 text-xs text-dnd-parchment/60">
              {sessionId ? `Sessão #${sessionId}` : 'Sem sessão ativa'} — eventos WS recentes (máx. 200).
            </p>
          </div>
          <button
            type="button"
            onClick={() => clearSessionDebugEvents()}
            className="inline-flex items-center gap-1 rounded-md border border-dnd-gold/20 px-2 py-1 text-[10px] uppercase tracking-wide text-dnd-parchment/70 transition hover:border-dnd-gold/40 hover:text-dnd-parchment"
            title="Limpar registro"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpar
          </button>
        </div>

        <div className="mt-4 max-h-[min(60vh,520px)] overflow-y-auto rounded-md border border-dnd-gold/10 bg-black/30 p-2 font-mono text-[11px] leading-relaxed text-dnd-parchment/85">
          {events.length === 0 ? (
            <p className="px-2 py-6 text-center text-dnd-parchment/45">
              Nenhum evento ainda. Ações e mensagens do mestre aparecem aqui.
            </p>
          ) : (
            <ul className="space-y-2">
              {events.map(event => (
                <li
                  key={event.id}
                  className={`whitespace-pre-wrap break-words rounded px-2 py-1.5 ${
                    event.direction === 'in'
                      ? 'border-l-2 border-sky-500/50 bg-sky-950/20'
                      : 'border-l-2 border-amber-500/50 bg-amber-950/20'
                  }`}
                >
                  {formatSessionDebugEvent(event)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DndCard>
    </div>
  );
}
