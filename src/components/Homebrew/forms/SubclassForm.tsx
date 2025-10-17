// src/components/Homebrew/forms/SubclassForm.tsx
'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as DndApiService from '@/services/dndApiService';
import * as HomebrewService from '@/services/homebrewService';
import { translateApiString } from '@/utils/translator';
import { Loader2, Plus, Trash2, Edit } from 'lucide-react';
import type { ApiListItem } from '@/types';
import FeatureCreator from './FeatureCreator';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
    onDataChange: (data: any) => void;
    initialData?: any;
}

const SubclassForm: React.FC<Props> = ({ onDataChange, initialData }) => {
    const { user } = useAuth();
    const [subclassData, setSubclassData] = useState(() => ({
        name: '',
        subclass_flavor: '',
        desc: [''],
        class: { index: '', name: '', url: '' },
        features: [],
        dependencies: [],
        official_index: '',
        ...(initialData || {}),
        features: initialData?.features || [],
    }));
    const [classes, setClasses] = useState<ApiListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFeatureCreatorOpen, setIsFeatureCreatorOpen] = useState(false);
    const [editingFeature, setEditingFeature] = useState<{ feature: any, index: number } | null>(null);

    const fetchRaces = useCallback(async () => {
        setIsLoading(true);
        try {
            const officialClassesPromise = DndApiService.getClasses();
            const homebrewClassesPromise = HomebrewService.listHomebrewContent('public', undefined, 'class');
            const myHomebrewClassesPromise = user ? HomebrewService.listHomebrewContent('mine', undefined, 'class') : Promise.resolve([]);

            const [officialClasses, homebrewClasses, myHomebrewClasses] = await Promise.all([
                officialClassesPromise,
                homebrewClassesPromise,
                myHomebrewClassesPromise
            ]);

            const all = [...(officialClasses?.results || [])];
            const myIds = new Set((myHomebrewClasses).map(c => c.id));

            all.push(...(myHomebrewClasses).map(c => ({ index: c.id, name: `(Meu) ${c.name}`, url: '' })));
            all.push(...homebrewClasses.filter(c => !myIds.has(c.id)).map(c => ({ index: c.id, name: `(H) ${c.name}`, url: '' })));

            setClasses(all.sort((a,b) => a.name.localeCompare(b.name)));
            
            if (initialData?.class?.index && !all.some(r => r.index === initialData.class.index)) {
                setClasses(prev => [initialData.class, ...prev]);
            }

        } catch (error) {
            console.error("Falha ao buscar classes:", error);
        } finally {
            setIsLoading(false);
        }
    }, [user, initialData]);

    useEffect(() => {
        fetchRaces();
    }, [fetchRaces]);


    useEffect(() => {
        onDataChange(subclassData);
    }, [subclassData, onDataChange]);

    const handleFieldChange = (field: keyof typeof subclassData, value: any) => {
        setSubclassData(prev => ({ ...prev, [field]: value }));
    };

    const handleClassChange = (classIndex: string) => {
        const selectedClass = classes.find(c => c.index === classIndex);
        if (selectedClass) {
            handleFieldChange('class', selectedClass);
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-..

[Rest of response trimmed due to length]