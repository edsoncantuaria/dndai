'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as HomebrewService from '@/services/homebrewService';
import { Loader2, Search, BookCopy } from 'lucide-react';

interface Props {
    homebrewType: HomebrewService.HomebrewContentType;
    sourceKind: 'translation' | 'fork';
    selectedIndex?: string | null;
    onOfficialLoaded: (payload: {
        sourceResource: string;
        sourceIndex: string;
        official: Record<string, unknown>;
    }) => void;
}

const SrdSourcePanel: React.FC<Props> = ({
    homebrewType,
    sourceKind,
    selectedIndex,
    onOfficialLoaded,
}) => {
    const [typeMap, setTypeMap] = useState<Record<string, string>>({});
    const [items, setItems] = useState<{ index: string; name: string }[]>([]);
    const [filter, setFilter] = useState('');
    const [isLoadingList, setIsLoadingList] = useState(false);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const srdResource = useMemo(() => typeMap[homebrewType] ?? null, [typeMap, homebrewType]);

    useEffect(() => {
        HomebrewService.getSrdTypeMap()
            .then((res) => setTypeMap(res.map))
            .catch(() => setError('Não foi possível carregar o mapa SRD.'));
    }, []);

    const loadList = useCallback(async () => {
        if (!srdResource) return;
        setIsLoadingList(true);
        setError(null);
        try {
            const data = await HomebrewService.listSrdResource(srdResource);
            setItems(data.results ?? []);
        } catch (err: any) {
            setError(err.message || 'Falha ao listar recursos oficiais.');
            setItems([]);
        } finally {
            setIsLoadingList(false);
        }
    }, [srdResource]);

    useEffect(() => {
        loadList();
    }, [loadList]);

    const filtered = useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return items;
        return items.filter(
            (item) => item.name.toLowerCase().includes(q) || item.index.toLowerCase().includes(q),
        );
    }, [items, filter]);

    const handleSelect = async (index: string) => {
        if (!srdResource) return;
        setIsLoadingDetail(true);
        setError(null);
        try {
            const official = await HomebrewService.getSrdResourceDetail(srdResource, index);
            onOfficialLoaded({ sourceResource: srdResource, sourceIndex: index, official });
        } catch (err: any) {
            setError(err.message || 'Falha ao carregar detalhe oficial.');
        } finally {
            setIsLoadingDetail(false);
        }
    };

    if (!srdResource) {
        return (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-100">
                O tipo <strong>{homebrewType}</strong> ainda não tem recurso mapeado na 5e-srd-api.
            </div>
        );
    }

    return (
        <div className="space-y-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">
                        Base SRD · {sourceKind === 'translation' ? 'Tradução' : 'Fork'}
                    </p>
                    <h3 className="text-lg font-semibold text-white inline-flex items-center gap-2">
                        <BookCopy className="h-5 w-5 text-cyan-300" />
                        Escolher recurso oficial ({srdResource})
                    </h3>
                    <p className="text-sm text-stone-400 mt-1">
                        {sourceKind === 'translation'
                            ? 'Selecione um item do SRD para traduzir campos como nome e descrição.'
                            : 'Selecione um item do SRD para clonar e adaptar como variante.'}
                    </p>
                </div>
                {(isLoadingList || isLoadingDetail) && <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />}
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Buscar por nome ou index..."
                    className="w-full rounded-xl border border-stone-700 bg-stone-950/70 py-2 pl-10 pr-3 text-stone-100 placeholder:text-stone-600 focus:border-cyan-400 outline-none"
                />
            </div>

            {error && <p className="text-sm text-rose-300">{error}</p>}

            <select
                value={selectedIndex ?? ''}
                onChange={(e) => e.target.value && handleSelect(e.target.value)}
                disabled={isLoadingList || isLoadingDetail}
                className="w-full rounded-xl border border-stone-700 bg-stone-950/70 p-2 text-stone-100 focus:border-cyan-400 outline-none"
            >
                <option value="">
                    {isLoadingList ? 'Carregando lista SRD...' : `Selecione (${filtered.length} itens)`}
                </option>
                {filtered.map((item) => (
                    <option key={item.index} value={item.index}>
                        {item.name} ({item.index})
                    </option>
                ))}
            </select>
        </div>
    );
};

export default SrdSourcePanel;
