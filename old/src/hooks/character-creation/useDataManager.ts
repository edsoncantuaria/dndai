// src/hooks/character-creation/useDataManager.ts
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import * as DndApiService from '../../services/dndApiService';
import type {
  ApiRace,
  ApiClass,
  ApiBackground,
  ApiClassLevel,
  ApiSubrace,
  Feat,
  ApiTrait,
  ApiSpell,
  ApiListItem,
  InventoryItem,
} from '../../types';
import { fetchDetailsInChunks } from '../../utils/apiUtils';
import { normalizeKey } from '@/utils/equipmentCacheBuilder';

const normalizeEquipmentUrl = (urlOrIndex: string): string => {
  if (!urlOrIndex) return '';
  if (urlOrIndex.startsWith('/api/data/equipment/')) return urlOrIndex;
  const normalized = urlOrIndex
    .replace(/^\/?api\/\d{0,4}\/?/, '')
    .replace(/^\/?v\d+\//, '')
    .replace(/^\/?equipment\//, '')
    .replace(/^\/+/, '');
  return `/api/data/equipment/${normalized}`;
};

export type DataManagerLoadingState = {
  /** Bloqueia a UI inteira — só na 1ª carga de equipamentos (passo 5+) */
  isBlocking: boolean;
  /** Busca em segundo plano (raça, classe, etc.) — não desmonta o wizard */
  isFetching: boolean;
  message: string;
  progress: number;
};

const idleLoading: DataManagerLoadingState = {
  isBlocking: false,
  isFetching: false,
  message: '',
  progress: 0,
};

async function loadDragonbornAncestryOptions() {
  const ancestryTrait = await DndApiService.getTraitDetails('draconic-ancestry');
  if (!ancestryTrait?.trait_specific?.subtrait_options?.from?.options) return [];
  const ancestryRefs = ancestryTrait.trait_specific.subtrait_options.from.options.map((o: any) => o.item);
  const ancestryDetails = await fetchDetailsInChunks(ancestryRefs, DndApiService.getTraitDetails, () => {});
  return ancestryDetails
    .map((detail) => {
      if (detail?.trait_specific?.damage_type) {
        return {
          index: detail.index,
          name: detail.name,
          damage_type: detail.trait_specific.damage_type.name,
        };
      }
      return null;
    })
    .filter(Boolean);
}

type UseDataManagerOptions = {
  /** Pré-carrega arsenal em background (não bloqueia a UI) */
  prefetchEquipment?: boolean;
  /** Exige arsenal pronto — bloqueia só neste passo se ainda não carregou */
  requireEquipment?: boolean;
};

export const useDataManager = (
  race: string,
  subrace: string,
  characterClass: string,
  background: string,
  options: UseDataManagerOptions = {}
) => {
  const { prefetchEquipment = true, requireEquipment = false } = options;

  const [raceDetails, setRaceDetails] = useState<ApiRace | null>(null);
  const [subraceDetails, setSubraceDetails] = useState<ApiSubrace | null>(null);
  const [classDetails, setClassDetails] = useState<ApiClass | null>(null);
  const [backgroundDetails, setBackgroundDetails] = useState<ApiBackground | null>(null);
  const [classLevels, setClassLevels] = useState<ApiClassLevel[] | null>(null);
  const [availableFeats, setAvailableFeats] = useState<Feat[]>([]);
  const [traitChoiceDetails, setTraitChoiceDetails] = useState<ApiTrait[]>([]);
  const [draconicAncestryOptions, setDraconicAncestryOptions] = useState<any[]>([]);
  const [classSpellOptions, setClassSpellOptions] = useState<ApiSpell[]>([]);
  const [subclassSpells, setSubclassSpells] = useState<ApiSpell[]>([]);
  const [allEquipment, setAllEquipment] = useState<InventoryItem[]>([]);
  const [equipmentCategoryCache, setEquipmentCategoryCache] = useState<Record<string, InventoryItem[]>>({});
  const [equipmentReady, setEquipmentReady] = useState(false);

  const [loadingStates, setLoadingStates] = useState<DataManagerLoadingState>(idleLoading);

  const equipmentInitStarted = useRef(false);
  const raceCache = useRef(new Map<string, ApiRace>());
  const subraceCache = useRef(new Map<string, ApiSubrace>());
  const classCache = useRef(new Map<string, { details: ApiClass; levels: ApiClassLevel[]; classSpells: ApiSpell[]; subclassSpells: ApiSpell[] }>());
  const backgroundCache = useRef(new Map<string, ApiBackground>());
  const traitsCacheKey = useRef<string>('');

  const setFetching = useCallback((message: string, progress = 0) => {
    setLoadingStates((prev) => ({
      ...prev,
      isFetching: true,
      message,
      progress,
    }));
  }, []);

  const clearFetching = useCallback(() => {
    setLoadingStates((prev) => ({
      ...prev,
      isFetching: false,
      message: '',
      progress: 0,
    }));
  }, []);

  const setBlocking = useCallback((message: string, progress = 0) => {
    setLoadingStates({
      isBlocking: true,
      isFetching: false,
      message,
      progress,
    });
  }, []);

  const initializeEquipment = useCallback(async () => {
    if (equipmentInitStarted.current) return;
    equipmentInitStarted.current = true;

    setFetching('Preparando arsenal…', 0);

    try {
      const categoryList = await DndApiService.getEquipmentCategories();
      const categories = categoryList?.results || [];
      const newCache: Record<string, InventoryItem[]> = {};
      let loadedCategories = 0;
      const totalCategories = Math.max(categories.length, 1);

      for (const cat of categories) {
        try {
          const categoryDetails = await DndApiService.getEquipmentCategoryDetails(cat.index);
          let itemsInCategory = (categoryDetails?.equipment || []) as InventoryItem[];
          itemsInCategory = itemsInCategory.map((item) => ({
            ...item,
            url: normalizeEquipmentUrl(item.url || item.index),
          }));
          if (itemsInCategory.length > 0) {
            newCache[normalizeKey(cat.index)] = itemsInCategory;
          }
        } catch (catError) {
          console.warn(`[useDataManager] Categoria ${cat.index}:`, catError);
        }
        loadedCategories++;
        setFetching(`Arsenal: ${cat.name}`, (loadedCategories / totalCategories) * 100);
      }

      setEquipmentCategoryCache(newCache);
      const uniqueEquipmentMap = new Map<string, InventoryItem>();
      Object.values(newCache)
        .flat()
        .forEach((item) => {
          if (item?.index) uniqueEquipmentMap.set(item.index, item);
        });
      setAllEquipment(
        Array.from(uniqueEquipmentMap.values()).map((item) => ({
          ...item,
          url: normalizeEquipmentUrl(item.url || item.index),
        }))
      );
      setEquipmentReady(true);
    } catch (err) {
      console.error('[useDataManager] Falha ao carregar equipamentos:', err);
      setEquipmentReady(true);
    } finally {
      clearFetching();
      setLoadingStates((prev) => ({ ...prev, isBlocking: false }));
    }
  }, [clearFetching, setFetching]);

  useEffect(() => {
    if (!prefetchEquipment) return;
    void initializeEquipment();
  }, [prefetchEquipment, initializeEquipment]);

  useEffect(() => {
    if (!requireEquipment || equipmentReady) return;
    setBlocking('Carregando equipamentos…');
    void initializeEquipment();
  }, [requireEquipment, equipmentReady, initializeEquipment, setBlocking]);

  useEffect(() => {
    if (!race) {
      setRaceDetails(null);
      setDraconicAncestryOptions([]);
      return;
    }

    let cancelled = false;

    const cached = raceCache.current.get(race);
    if (cached) {
      setRaceDetails(cached);
      if (race === 'dragonborn') {
        void loadDragonbornAncestryOptions().then((options) => {
          if (!cancelled) setDraconicAncestryOptions(options);
        });
      } else {
        setDraconicAncestryOptions([]);
      }
      return () => {
        cancelled = true;
      };
    }

    const fetchRace = async () => {
      setFetching('Carregando raça…');
      try {
        const details = await DndApiService.getRaceDetails(race);
        if (cancelled) return;
        raceCache.current.set(race, details);
        setRaceDetails(details);

        if (race === 'dragonborn') {
          const options = await loadDragonbornAncestryOptions();
          if (!cancelled) setDraconicAncestryOptions(options);
        } else {
          setDraconicAncestryOptions([]);
        }
      } finally {
        if (!cancelled) clearFetching();
      }
    };

    void fetchRace();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race]);

  useEffect(() => {
    if (!subrace) {
      setSubraceDetails(null);
      return;
    }

    const cached = subraceCache.current.get(subrace);
    if (cached) {
      setSubraceDetails(cached);
      return;
    }

    let cancelled = false;
    void (async () => {
      setFetching('Carregando sub-raça…');
      try {
        const details = await DndApiService.getSubraceDetails(subrace);
        if (!cancelled && details) {
          subraceCache.current.set(subrace, details);
          setSubraceDetails(details);
        }
      } finally {
        if (!cancelled) clearFetching();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [subrace, clearFetching, setFetching]);

  useEffect(() => {
    if (!characterClass) {
      setClassDetails(null);
      setClassLevels(null);
      setClassSpellOptions([]);
      setSubclassSpells([]);
      return;
    }

    const cached = classCache.current.get(characterClass);
    if (cached) {
      setClassDetails(cached.details);
      setClassLevels(cached.levels);
      setClassSpellOptions(cached.classSpells);
      setSubclassSpells(cached.subclassSpells);
      return;
    }

    let cancelled = false;

    void (async () => {
      setFetching('Carregando classe…');
      try {
        const [rawDetails, levelsData] = await Promise.all([
          DndApiService.getClassDetails(characterClass),
          DndApiService.getClassLevels(characterClass),
        ]);
        if (cancelled) return;

        // Resposta legada/cache corrompido podia devolver só levels[] em vez da ficha da classe.
        const details =
          rawDetails &&
          typeof rawDetails === 'object' &&
          !Array.isArray(rawDetails) &&
          typeof (rawDetails as ApiClass).hit_die === 'number'
            ? (rawDetails as ApiClass)
            : null;

        const levels = Array.isArray(levelsData) ? levelsData : levelsData ? Object.values(levelsData) : [];

        let classSpells: ApiSpell[] = [];
        let subSpells: ApiSpell[] = [];

        if (details?.spellcasting) {
          const spellsResponse = await DndApiService.getSpellsForClass(characterClass);
          if (spellsResponse?.results) {
            const spellDetails = await fetchDetailsInChunks(
              spellsResponse.results,
              DndApiService.getSpellDetails,
              (loaded, total, progress) => setFetching(`Magias ${loaded}/${total}`, progress)
            );
            classSpells = spellDetails.filter((s): s is ApiSpell => s !== null && s.level <= 1);
          }
        }

        if (details?.subclasses?.[0]) {
          const subClassDetails = await DndApiService.getSubclassDetails(details.subclasses[0].index);
          if (subClassDetails?.spells) {
            const spellRefs = subClassDetails.spells
              .filter((s) => s.prerequisites.some((p) => p && p.url.endsWith('/1')))
              .map((s) => s.spell);
            if (spellRefs.length > 0) {
              const spellDetails = await fetchDetailsInChunks(spellRefs, DndApiService.getSpellDetails, () => {});
              subSpells = spellDetails.filter(Boolean) as ApiSpell[];
            }
          }
        }

        if (cancelled) return;

        classCache.current.set(characterClass, {
          details,
          levels: levels as ApiClassLevel[],
          classSpells,
          subclassSpells: subSpells,
        });

        setClassDetails(details);
        setClassLevels(levels as ApiClassLevel[]);
        setClassSpellOptions(classSpells);
        setSubclassSpells(subSpells);
      } finally {
        if (!cancelled) clearFetching();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [characterClass, clearFetching, setFetching]);

  useEffect(() => {
    if (!background) {
      setBackgroundDetails(null);
      return;
    }

    const cached = backgroundCache.current.get(background);
    if (cached) {
      setBackgroundDetails(cached);
      return;
    }

    let cancelled = false;
    void (async () => {
      setFetching('Carregando antecedente…');
      try {
        const details = await DndApiService.getBackgroundDetails(background);
        if (!cancelled && details) {
          backgroundCache.current.set(background, details);
          setBackgroundDetails(details);
        }
      } finally {
        if (!cancelled) clearFetching();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [background, clearFetching, setFetching]);

  useEffect(() => {
    if (!raceDetails) {
      setTraitChoiceDetails([]);
      traitsCacheKey.current = '';
      return;
    }

    if (subrace && !subraceDetails) {
      return;
    }

    const key = `${race}|${subrace || ''}|${subraceDetails?.index ?? ''}`;
    if (traitsCacheKey.current === key) {
      return;
    }

    let cancelled = false;
    void (async () => {
      setFetching('Analisando traços…');
      try {
        const allTraitList = [...(raceDetails.traits || []), ...(subraceDetails?.racial_traits || [])].filter(
          Boolean
        );
        const traitDetails = await fetchDetailsInChunks<ApiListItem, ApiTrait>(
          allTraitList,
          DndApiService.getTraitDetails,
          (l, t, p) => setFetching(`Traços ${l}/${t}`, p)
        );
        if (!cancelled) {
          traitsCacheKey.current = key;
          setTraitChoiceDetails(traitDetails.filter(Boolean));
        }
      } finally {
        if (!cancelled) clearFetching();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [raceDetails, subraceDetails, subrace, race, clearFetching, setFetching]);

  const fetchFeats = async () => {
    if (availableFeats.length > 0) return;
    setFetching('Carregando talentos…');
    try {
      const featsList = await DndApiService.getFeats();
      if (featsList?.results) {
        const featDetails = await fetchDetailsInChunks(featsList.results, DndApiService.getFeatDetails, (l, t, p) =>
          setFetching(`Talentos ${l}/${t}`, p)
        );
        setAvailableFeats(featDetails as Feat[]);
      }
    } finally {
      clearFetching();
    }
  };

  const safeCache = useMemo(() => equipmentCategoryCache || {}, [equipmentCategoryCache]);

  const loadingWithLegacy = useMemo(
    () => ({
      ...loadingStates,
      /** Bloqueio de tela cheia — preferir isBlocking */
      isLoading: loadingStates.isBlocking,
    }),
    [loadingStates]
  );

  return {
    details: {
      raceDetails,
      subraceDetails,
      classDetails,
      backgroundDetails,
      classLevels,
      availableFeats,
      traitChoiceDetails,
      draconicAncestryOptions,
      classSpellOptions,
      subclassSpells,
    },
    allEquipment,
    equipmentCategoryCache: safeCache,
    equipmentReady,
    loadingStates: loadingWithLegacy,
    fetchFeats,
  };
};
