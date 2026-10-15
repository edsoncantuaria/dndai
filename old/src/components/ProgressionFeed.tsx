// src/components/ProgressionFeed.tsx
'use client';

import React from 'react';
import type { ProgressionFeedItem } from '@/types';
import { Trophy, Star } from 'lucide-react';

interface ProgressionFeedProps {
    items: ProgressionFeedItem[];
}

const iconMap: Record<ProgressionFeedItem['type'], React.ReactNode> = {
    xp_gain: <Star className="h-3.5 w-3.5 text-amber-300 shrink-0" />,
    level_up: <Trophy className="h-3.5 w-3.5 text-emerald-300 shrink-0" />,
};

const ProgressionFeed: React.FC<ProgressionFeedProps> = ({ items }) => {
    if (!items?.length) return null;

    const recent = items.slice(-4).reverse();

    return (
        <div className="mt-3 bg-stone-900/70 border border-stone-700 rounded-md px-3 py-2">
            <div className="flex items-center gap-2 text-[0.65rem] uppercase tracking-wide text-stone-400 font-semibold mb-1">
                <Trophy className="h-3 w-3 text-amber-300" />
                <span>Conquistas Recentes</span>
            </div>
            <ul className="space-y-1">
                {recent.map(item => {
                    const detail = [item.source, item.detail].filter(Boolean).join(' • ');
                    return (
                        <li key={item.id} className="flex items-start gap-2 text-sm rounded-md bg-stone-800/50 px-2 py-1 border border-stone-700/70">
                            <div className="mt-0.5">
                                {iconMap[item.type] ?? <Star className="h-3.5 w-3.5 text-amber-300" />}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-amber-200 font-medium leading-tight">{item.summary}</span>
                                    {item.type === 'xp_gain' && typeof item.xp === 'number' && (
                                        <span className="text-[0.65rem] font-mono text-amber-300 whitespace-nowrap">+{item.xp} XP</span>
                                    )}
                                    {item.type === 'level_up' && typeof item.level === 'number' && (
                                        <span className="text-[0.65rem] font-mono text-emerald-300 whitespace-nowrap">Nível {item.level}</span>
                                    )}
                                </div>
                                {detail && (
                                    <p className="text-[0.7rem] text-stone-400 leading-tight mt-0.5">
                                        {detail}
                                    </p>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default ProgressionFeed;

