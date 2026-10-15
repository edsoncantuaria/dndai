'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { getSessionFacts, type SessionFactsResponse } from '@/services/gameService';
import { DndCard } from '@/components/primitives';
import { cn } from '@/lib/utils';

function FactSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <DndCard padding="none" hover={false} className="overflow-hidden border-dnd-gold/12">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-ui text-xs font-semibold uppercase tracking-wider text-dnd-gold">
          {title}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 text-dnd-parchment-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t border-dnd-gold/10 px-3 py-2">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </DndCard>
  );
}

export function SessionFactsPanel({ sessionId }: { sessionId: number | null }) {
  const [facts, setFacts] = useState<SessionFactsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setFacts(null);
      return;
    }
    setLoading(true);
    getSessionFacts(sessionId)
      .then(setFacts)
      .catch(() => setFacts(null))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-dnd-gold" />
      </div>
    );
  }

  if (!facts?.atomicFacts?.length && !facts?.storySummary) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 font-ui text-xs uppercase tracking-wider text-dnd-gold">
        <Sparkles className="h-4 w-4" />
        Memória da sessão
      </p>
      {facts.storySummary ? (
        <FactSection title="Resumo" defaultOpen>
          <p className="font-narrative text-sm leading-relaxed text-dnd-parchment">{facts.storySummary}</p>
        </FactSection>
      ) : null}
      {facts.atomicFacts && facts.atomicFacts.length > 0 ? (
        <FactSection title={`Fatos registrados (${facts.atomicFacts.length})`} defaultOpen>
          <ul className="space-y-2">
            {facts.atomicFacts.slice(0, 12).map((fact) => (
              <li
                key={fact.id}
                className="rounded-md border border-dnd-gold/10 bg-dnd-obsidian/50 p-2"
              >
                <p className="font-ui text-[10px] font-semibold uppercase tracking-wide text-dnd-gold">
                  {fact.category}
                  {fact.subject ? (
                    <span className="font-normal normal-case text-dnd-parchment-muted">
                      {' '}
                      · {fact.subject}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 font-narrative text-sm leading-relaxed text-dnd-parchment">
                  {fact.fact}
                </p>
              </li>
            ))}
          </ul>
        </FactSection>
      ) : null}
    </div>
  );
}
