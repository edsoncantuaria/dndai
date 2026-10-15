'use client';

import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';

type Props<T> = {
    title: string;
    items: T[];
    renderItem: (item: T, index: number) => ReactNode;
    itemKey: (item: T, index: number) => string;
    maxVisible?: number;
    maxHeightClass?: string;
    defaultSectionOpen?: boolean;
    emptyMessage?: string;
};

export function CollapsibleItemList<T>({
    title,
    items,
    renderItem,
    itemKey,
    maxVisible = 4,
    maxHeightClass = 'max-h-48',
    defaultSectionOpen = true,
    emptyMessage,
}: Props<T>) {
    const [sectionOpen, setSectionOpen] = useState(defaultSectionOpen);
    const [showAll, setShowAll] = useState(false);

    if (items.length === 0) {
        return emptyMessage ? (
            <div className="border-t border-dnd-gold/10 pt-3">
                <p className="font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">
                    {title}
                </p>
                <p className="mt-2 font-ui text-xs text-dnd-parchment-muted">{emptyMessage}</p>
            </div>
        ) : null;
    }

    const visibleItems = showAll ? items : items.slice(0, maxVisible);
    const hiddenCount = items.length - maxVisible;

    return (
        <div className="border-t border-dnd-gold/10 pt-3">
            <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left"
                onClick={() => setSectionOpen(v => !v)}
                aria-expanded={sectionOpen}
            >
                <p className="font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">
                    {title}
                    <span className="ml-1.5 text-dnd-gold/80">({items.length})</span>
                </p>
                <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 text-dnd-gold/70 transition-transform ${sectionOpen ? 'rotate-180' : ''}`}
                />
            </button>
            {sectionOpen ? (
                <>
                    <div
                        className={`mt-2 space-y-2 overflow-y-auto pr-1 ${showAll ? maxHeightClass : ''}`}
                    >
                        {visibleItems.map((item, index) => (
                            <div key={itemKey(item, index)}>{renderItem(item, index)}</div>
                        ))}
                    </div>
                    {hiddenCount > 0 && !showAll ? (
                        <button
                            type="button"
                            onClick={() => setShowAll(true)}
                            className="mt-2 font-ui text-[10px] uppercase tracking-wide text-dnd-gold underline hover:text-dnd-gold/80"
                        >
                            Ver mais ({hiddenCount})
                        </button>
                    ) : null}
                    {showAll && items.length > maxVisible ? (
                        <button
                            type="button"
                            onClick={() => setShowAll(false)}
                            className="mt-2 font-ui text-[10px] uppercase tracking-wide text-dnd-parchment-muted underline hover:text-dnd-parchment"
                        >
                            Mostrar menos
                        </button>
                    ) : null}
                </>
            ) : null}
        </div>
    );
}
