'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPin, Map as MapIcon, Loader2, Compass, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getWorldMapSnapshot, type WorldMapSnapshot } from '@/services/gameService';

type LocationHudProps = {
    sessionId: number | null;
    regionLabel: string;
    poiLabel?: string | null;
    timeLabel?: string;
    weatherLabel?: string;
    onOpenMap?: () => void;
    className?: string;
};

const LocationHud: React.FC<LocationHudProps> = ({
    sessionId,
    regionLabel,
    poiLabel,
    timeLabel,
    weatherLabel,
    onOpenMap,
    className,
}) => {
    const [snapshot, setSnapshot] = useState<WorldMapSnapshot | null>(null);
    const [loading, setLoading] = useState(false);

    const loadSnapshot = useCallback(async () => {
        if (!sessionId) return;
        setLoading(true);
        try {
            const data = await getWorldMapSnapshot(sessionId);
            setSnapshot(data);
        } catch {
            setSnapshot(null);
        } finally {
            setLoading(false);
        }
    }, [sessionId]);

    useEffect(() => {
        void loadSnapshot();
    }, [loadSnapshot]);

    const currentRegion = useMemo(() => {
        if (!snapshot?.regions?.length) return null;
        return snapshot.regions.find(r => r.isCurrent) ?? null;
    }, [snapshot]);

    const poiStats = useMemo(() => {
        if (!currentRegion?.pointsOfInterest?.length) return null;
        const total = currentRegion.pointsOfInterest.length;
        const discovered = currentRegion.pointsOfInterest.filter(p => p.isDiscovered).length;
        return { total, discovered, hidden: total - discovered };
    }, [currentRegion]);

    return (
        <section
            className={cn(
                'rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3',
                className,
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.35em] text-stone-500 font-semibold flex items-center gap-1.5">
                        <Compass className="h-3.5 w-3.5 text-amber-300" />
                        Onde estou
                    </p>
                    <h4 className="text-lg font-serif text-white truncate">{regionLabel}</h4>
                    {poiLabel ? (
                        <p className="text-sm text-amber-100/90 truncate">{poiLabel}</p>
                    ) : null}
                    {currentRegion?.summary ? (
                        <p className="text-xs text-stone-400 line-clamp-2">{currentRegion.summary}</p>
                    ) : null}
                </div>
                <button
                    type="button"
                    onClick={onOpenMap}
                    disabled={!sessionId || loading}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapIcon className="h-3.5 w-3.5" />}
                    Mapa
                </button>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-stone-300">
                {timeLabel ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1">
                        <MapPin className="h-3 w-3 text-stone-400" />
                        {timeLabel}
                    </span>
                ) : null}
                {weatherLabel ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1">
                        {weatherLabel}
                    </span>
                ) : null}
                {poiStats ? (
                    <>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
                            <Eye className="h-3 w-3" />
                            {poiStats.discovered} POI{poiStats.discovered !== 1 ? 's' : ''} conhecido{poiStats.discovered !== 1 ? 's' : ''}
                        </span>
                        {poiStats.hidden > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-stone-500/10 px-2.5 py-1 text-stone-400">
                                <EyeOff className="h-3 w-3" />
                                {poiStats.hidden} oculto{poiStats.hidden !== 1 ? 's' : ''}
                            </span>
                        ) : null}
                    </>
                ) : null}
            </div>
        </section>
    );
};

export default LocationHud;
