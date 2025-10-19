// src/hooks/character-creation/useDataManager.ts
import { useState, useEffect, useMemo } from 'react';
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

export const useDataManager = (
  race: string,
  subrace: string,
  characterClass: string,
  background: string
) => {
  // Estados principais
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

  const [loadingStates, setLoadingStates] = useState({
    isLoading: false,
    message: '',
    progress: 0,
  });

  const [allEquipment, setAllEquipment] = useState<InventoryItem[]>([]);
  const [equipmentCategoryCache, setEquipmentCategoryCache] = useState<
    Record<string, InventoryItem[]>
  >({});

  /* ===========================================================
   * ⚔️ Pré-carregamento de todos os equipamentos
   * =========================================================== */
  useEffect(() => {
    const fetchBaseEquipment = async () => {
      setLoadingStates({ isLoading: true, message: 'Carregando o arsenal...', progress: 0 });
      try {
        const equipmentList = await DndApiService.getEquipment();
        if (!Array.isArray(equipmentList)) throw new Error('Lista de equipamentos inválida.');

        const unifiedEquipment = equipmentList as InventoryItem[];
        setAllEquipment(unifiedEquipment);

        const newCache: Record<string, InventoryItem[]> = {};

        const normalize = (str: string) =>
          str.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');

        const add = (keys: string[], ...items: InventoryItem[]) => {
          keys.forEach((k) => {
            const nk = normalize(k);
            if (!nk) return;
            if (!newCache[nk]) newCache[nk] = [];
            newCache[nk].push(...items);
          });
        };

        /* --- Construção inteligente do cache --- */
        for (const item of unifiedEquipment) {
          if (!item) continue;

          const name = item.name.toLowerCase();
          const index = item.index.toLowerCase();

          const categories = [
            item.equipment_category?.index,
            (item as any).gear_category?.index,
            item.weapon_category,
            item.armor_category,
          ]
            .filter(Boolean)
            .map(String);

          // Categorias base do SRD
          add(categories, item);

          // Aliases universais para armas
          if (item.weapon_category) {
            const w = item.weapon_category.toLowerCase();
            add(
              [
                `${w}-weapon`,
                `${w}-weapons`,
                `${w} weapon`,
                `${w} weapons`,
                `any ${w} weapon`,
                `any ${w} weapons`,
              ],
              item
            );
          }

          // Escudos
          if (name.includes('shield')) {
            add(['shield', 'shields', 'a shield', 'any shield'], item);
          }

          // Símbolos sagrados
          if (
            index.includes('holy-symbol') ||
            name.includes('símbolo') ||
            name.includes('amuleto') ||
            name.includes('emblema') ||
            name.includes('relicário')
          ) {
            add(['holy-symbol', 'holy-symbols', 'holy symbol', 'holy symbols'], item);
          }

          // Focos arcanos
          if (index.match(/(crystal|orb|rod|staff|wand)/i)) {
            add(['arcane focus', 'arcane foci'], item);
          }

          // Focos druidicos
          if (index.match(/(mistletoe|totem|wooden-staff|yew-wand)/i)) {
            add(['druidic focus', 'druidic foci'], item);
          }

          // Armas corpo a corpo e à distância
          if (item.weapon_range === 'Melee') {
            add(
              [
                'melee-weapon',
                'melee-weapons',
                'melee weapon',
                'simple melee weapon',
                'martial melee weapon',
                'any melee weapon',
              ],
              item
            );
          }
          if (item.weapon_range === 'Ranged') {
            add(
              [
                'ranged-weapon',
                'ranged-weapons',
                'ranged weapon',
                'simple ranged weapon',
                'martial ranged weapon',
                'any ranged weapon',
              ],
              item
            );
          }

          // Itens gerais
          if (item.equipment_category?.index === 'adventuring-gear') {
            add(['gear', 'adventuring gear'], item);
          }
        }

        /* --- Agrupamentos compostos --- */
        const simple = unifiedEquipment.filter((i) => i.weapon_category === 'Simple');
        const martial = unifiedEquipment.filter((i) => i.weapon_category === 'Martial');

        add(['simple-weapons', 'simple weapon', 'any simple weapon'], ...simple);
        add(['martial-weapons', 'martial weapon', 'any martial weapon'], ...martial);

        // Garante fallback explícito
        newCache['holy-symbol'] ??= unifiedEquipment.filter((i) =>
          i.index.includes('holy-symbol')
        );

        setEquipmentCategoryCache(newCache);

        if (process.env.NODE_ENV === 'development') {
          console.log('[Equipment Cache Loaded]', Object.keys(newCache));
        }
      } catch (err) {
        console.error('Falha ao carregar equipamentos:', err);
        setEquipmentCategoryCache({});
      } finally {
        setLoadingStates({ isLoading: false, message: '', progress: 0 });
      }
    };

    fetchBaseEquipment();
  }, []);

  /* ===========================================================
   * 🧬 Raças, Classes, Backgrounds, Feats etc.
   * =========================================================== */

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
