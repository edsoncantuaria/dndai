'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchSessionCampaignState, type PenaiSessionCampaign } from '@/services/penaiApi';

export function useSessionCampaign(
    sessionId: number | null,
    refreshKey = 0,
): {
    campaign: PenaiSessionCampaign | null;
    loading: boolean;
    error: string | null;
    refetch: () => void;
} {
    const [campaign, setCampaign] = useState<PenaiSessionCampaign | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(() => {
        if (!sessionId) return;
        setLoading(true);
        setError(null);
        void fetchSessionCampaignState(sessionId)
            .then(setCampaign)
            .catch(err => {
                setError(err instanceof Error ? err.message : 'Erro ao carregar campanha');
                setCampaign(null);
            })
            .finally(() => setLoading(false));
    }, [sessionId]);

    useEffect(() => {
        if (!sessionId) {
            setCampaign(null);
            return;
        }
        refetch();
    }, [sessionId, refreshKey, refetch]);

    return { campaign, loading, error, refetch };
}
