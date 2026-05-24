'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { cn } from '@/lib/utils';

const EASE = [0.22, 1, 0.36, 1] as const;

export interface StageTransitionProps {
  stageKey: string;
  children: React.ReactNode;
  className?: string;
}

export function StageTransition({ stageKey, children, className }: StageTransitionProps) {
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return <div className={cn('min-h-full w-full', className)}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stageKey}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease: EASE }}
        className={cn('min-h-full w-full', className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
