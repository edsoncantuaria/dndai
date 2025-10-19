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


// ============================================================
// 🧩 Normalizador de URLs para equipamentos (mesmo do outro hook)
// ============================================================
const normalizeEquipmentUrl = (urlOrIndex: string): string => {
  if (!urlOrIndex) return '';

  if (urlOrIndex.startsWith('/api/data/equipment/')) return urlOrIndex;

  const normalized = urlOrIndex
    .replace(/^\/?api\/\d{0,4}\/?/, '') // remove /api/2014/, /api/5e/, etc
    .replace(/^\/?v\d+\//, '')          // remove /v1/, /v2/, /v10/, etc
    .replace(/^\/?equipment\//, '')     // remove equipment/
    .replace(/^\/+/, '');               // remove barras extras

  return `/api/data/equipment/${normalized}`;
};

export const useDataManager = (race: string, subrace: string, characterClass: string, background: string) => {
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

  const [loadingStates, setLoadingStates] = useState({
    isLoading: false,
    message: '',
    progress: 0,
  });

  const initialized = useRef(false);

  /** =============================================================
   * ⚙️ Construção e cache do arsenal base
   * ============================================================= */
  const initializeEquipment = useCallback(async () => {
    if (initialized.current) return;
    initialized.current = true;
  
    setLoadingStates({ isLoading: true, message: 'Carregando o arsenal...', progress: 0 });
    console.log('[useDataManager] 🚀 Iniciando carregamento de equipamentos...');
    
    try {
      // 1. Pega a lista de todas as categorias
      const categoryList = await DndApiService.getEquipmentCategories();
      const categories = categoryList?.results || [];
      console.log(`[useDataManager] 📚 Encontradas ${categories.length} categorias de equipamento.`);
  
      const newCache: Record<string, InventoryItem[]> = {};
  
      // 2. Para cada categoria, busca seus detalhes (que contém a lista de itens)
      for (const cat of categories) {
        try {
          const categoryDetails = await DndApiService.getEquipmentCategoryDetails(cat.index);
          let itemsInCategory = (categoryDetails?.equipment || []) as InventoryItem[];
  
          // 🔄 Normaliza todas as URLs antes de armazenar no cache
          itemsInCategory = itemsInCategory.map((item) => ({
            ...item,
            url: normalizeEquipmentUrl(item.url || item.index),
          }));
  
          if (itemsInCategory.length > 0) {
            const normalizedCatKey = normalizeKey(cat.index);
            newCache[normalizedCatKey] = itemsInCategory;
            console.log(
              `[useDataManager]   - Categoria "${normalizedCatKey}" cacheada com ${itemsInCategory.length} itens.`
            );
          }
        } catch (catError) {
          console.warn(`[useDataManager] ⚠️ Falha ao buscar detalhes da categoria ${cat.index}:`, catError);
        }
      }
      
      setEquipmentCategoryCache(newCache);
      console.log('[useDataManager] 📦 Cache de categorias construído. Chaves:', Object.keys(newCache));
  
      // 4. Constrói a lista plana de todos os equipamentos para buscas rápidas
      const flatEquipmentList = Object.values(newCache).flat();
      const uniqueEquipmentMap = new Map<string, InventoryItem>();
      flatEquipmentList.forEach(item => {
        if (item && item.index) {
          uniqueEquipmentMap.set(item.index, item);
        }
      });
  
      const allUniqueEquipment = Array.from(uniqueEquipmentMap.values()).map(item => ({
        ...item,
        url: normalizeEquipmentUrl(item.url || item.index),
      }));
  
      setAllEquipment(allUniqueEquipment);
      console.log(`[useDataManager] ✅ Lista de equipamentos unificada com ${allUniqueEquipment.length} itens únicos.`);
  
    } catch (err) {
      console.error('[useDataManager] ❌ Falha catastrófica ao carregar equipamentos:', err);
    } finally {
      setLoadingStates({ isLoading: false, message: '', progress: 0 });
    }
  }, []);
  

  useEffect(() => {
    initializeEquipment();
  }, [initializeEquipment]);


  /** =============================================================
   * 🧬 Demais fetches (raças, classes, magias etc.)
   * ============================================================= */

  useEffect(() => {
    if (!race) {
      setRaceDetails(null);
      setDraconicAncestryOptions([]);
      return;
    }

    const fetchRace = async () => {
      setLoadingStates({ isLoading: true, message: 'Buscando linhagens...', progress: 50 });
      const details = await DndApiService.getRaceDetails(race);
      setRaceDetails(details);

      if (race === 'dragonborn') {
        const ancestryTrait = await DndApiService.getTraitDetails('draconic-ancestry');
        if (ancestryTrait?.trait_specific?.subtrait_options?.from?.options) {
          const ancestryRefs = ancestryTrait.trait_specific.subtrait_options.from.options.map(
            (o: any) => o.item
          );

          const ancestryDetails = await fetchDetailsInChunks(
            ancestryRefs,
            DndApiService.getTraitDetails,
            () => {}
          );

          const detailedOptions = ancestryDetails
            .map((detail) => {
              if (detail && detail.trait_specific?.damage_type) {
                return {
                  index: detail.index,
                  name: detail.name,
                  damage_type: detail.trait_specific.damage_type.name,
                };
              }
              return null;
            })
            .filter(Boolean);

          setDraconicAncestryOptions(detailedOptions);
        }
      } else {
        setDraconicAncestryOptions([]);
      }

      setLoadingStates({ isLoading: false, message: '', progress: 0 });
    };

    fetchRace();
  }, [race]);

  useEffect(() => {
    if (!subrace) {
      setSubraceDetails(null);
      return;
    }

    const fetchSubrace = async () => {
      setLoadingStates({ isLoading: true, message: 'Consultando sub-raças...', progress: 50 });
      setSubraceDetails(await DndApiService.getSubraceDetails(subrace));
      setLoadingStates({ isLoading: false, message: '', progress: 0 });
    };
    fetchSubrace();
  }, [subrace]);

  useEffect(() => {
    if (!characterClass) {
      setClassDetails(null);
      setClassLevels(null);
      setClassSpellOptions([]);
      setSubclassSpells([]);
      return;
    }

    const fetchClass = async () => {
      setLoadingStates({ isLoading: true, message: 'Estudando as artes...', progress: 0 });
      const [details, levelsData] = await Promise.all([
        DndApiService.getClassDetails(characterClass),
        DndApiService.getClassLevels(characterClass),
      ]);

      setClassDetails(details);

      const levels = Array.isArray(levelsData)
        ? levelsData
        : levelsData
        ? Object.values(levelsData)
        : [];

      setClassLevels(levels as ApiClassLevel[]);

      if (details?.spellcasting) {
        const spellsResponse = await DndApiService.getSpellsForClass(characterClass);
        if (spellsResponse?.results) {
          const spellDetails = await fetchDetailsInChunks(
            spellsResponse.results,
            DndApiService.getSpellDetails,
            (loaded, total, progress) =>
              setLoadingStates({
                isLoading: true,
                message: `Carregando Magias ${loaded} de ${total}...`,
                progress,
              })
          );
          setClassSpellOptions(
            spellDetails.filter((s): s is ApiSpell => s !== null && s.level <= 1)
          );
        }
      } else {
        setClassSpellOptions([]);
      }

      setSubclassSpells([]);
      if (details?.subclasses?.[0]) {
        const subClassDetails = await DndApiService.getSubclassDetails(details.subclasses[0].index);
        if (subClassDetails?.spells) {
          const spellRefs = subClassDetails.spells
            .filter((s) => s.prerequisites.some((p) => p && p.url.endsWith('/1')))
            .map((s) => s.spell);
          if (spellRefs.length > 0) {
            const spellDetails = await fetchDetailsInChunks(
              spellRefs,
              DndApiService.getSpellDetails,
              () => {}
            );
            setSubclassSpells(spellDetails.filter(Boolean) as ApiSpell[]);
          }
        }
      }

      setLoadingStates({ isLoading: false, message: '', progress: 0 });
    };

    fetchClass();
  }, [characterClass]);

  useEffect(() => {
    if (!background) {
      setBackgroundDetails(null);
      return;
    }

    const fetchBackground = async () => {
      setLoadingStates({ isLoading: true, message: 'Relembrando o passado...', progress: 50 });
      const details = await DndApiService.getBackgroundDetails(background);
      setBackgroundDetails(details);
      setLoadingStates({ isLoading: false, message: '', progress: 0 });
    };

    fetchBackground();
  }, [background]);

  useEffect(() => {
    const fetchRacialTraits = async () => {
      if (!raceDetails) {
        setTraitChoiceDetails([]);
        return;
      }
      setLoadingStates({ isLoading: true, message: 'Analisando traços...', progress: 0 });
      const allTraitList = [
        ...(raceDetails.traits || []),
        ...(subraceDetails?.racial_traits || []),
      ].filter(Boolean);
      const traitDetails = await fetchDetailsInChunks<ApiListItem, ApiTrait>(
        allTraitList,
        DndApiService.getTraitDetails,
        (l, t, p) => {
          setLoadingStates({
            isLoading: true,
            message: `Analisando Traços ${l} de ${t}...`,
            progress: p,
          });
        }
      );
      setTraitChoiceDetails(traitDetails.filter(Boolean));
      setLoadingStates({ isLoading: false, message: '', progress: 0 });
    };
    fetchRacialTraits();
  }, [raceDetails, subraceDetails]);

  const fetchFeats = async () => {
    setLoadingStates({ isLoading: true, message: 'Procurando talentos...', progress: 0 });
    const featsList = await DndApiService.getFeats();
    if (featsList?.results) {
      const featDetails = await fetchDetailsInChunks(
        featsList.results,
        DndApiService.getFeatDetails,
        (l, t, p) => {
          setLoadingStates({
            isLoading: true,
            message: `Carregando Talentos ${l} de ${t}...`,
            progress: p,
          });
        }
      );
      setAvailableFeats(featDetails as Feat[]);
    }
    setLoadingStates({ isLoading: false, message: '', progress: 0 });
  };

  const safeCache = useMemo(() => equipmentCategoryCache || {}, [equipmentCategoryCache]);

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
    loadingStates,
    fetchFeats,
  };
};
