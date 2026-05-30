/**
 * Ícones de POI no mapa mundi (estilo Skyrim: losango + glifo por categoria).
 */

export type PoiIconKind =
    | 'tavern'
    | 'guild'
    | 'shop'
    | 'palace'
    | 'temple'
    | 'dungeon'
    | 'harbor'
    | 'forge'
    | 'library'
    | 'arcane'
    | 'camp'
    | 'landmark';

export type PoiIconSpec = {
    kind: PoiIconKind;
    label: string;
    /** Preenchimento do losango */
    gem: string;
    /** Contorno do losango */
    rim: string;
    /** Glifo interno */
    glyph: string;
    /** path d em viewBox 0 0 12 12 */
    path: string;
};

const SPECS: Record<PoiIconKind, PoiIconSpec> = {
    tavern: {
        kind: 'tavern',
        label: 'Taverna / estalagem',
        gem: '#7c4a1e',
        rim: '#fcd34d',
        glyph: '#fef3c7',
        path: 'M3 4h6v1H3zm1 2h4v4H4zm1 1v2h2V7z',
    },
    guild: {
        kind: 'guild',
        label: 'Guilda / quartel',
        gem: '#1e3a5f',
        rim: '#fcd34d',
        glyph: '#e0f2fe',
        path: 'M6 2L2 5v5h8V5zm0 2l2 2v3H4V6z',
    },
    shop: {
        kind: 'shop',
        label: 'Mercado / loja',
        gem: '#14532d',
        rim: '#fcd34d',
        glyph: '#dcfce7',
        path: 'M2 4h8l-1 6H3zm1.5-2h5L8 4H4z',
    },
    palace: {
        kind: 'palace',
        label: 'Palácio / corte',
        gem: '#581c87',
        rim: '#fcd34d',
        glyph: '#f3e8ff',
        path: 'M6 1l1 2h2l-2 1.5L8 7 6 5.5 4 7l1-2.5L3 3h2z',
    },
    temple: {
        kind: 'temple',
        label: 'Templo / santuário',
        gem: '#334155',
        rim: '#fcd34d',
        glyph: '#f1f5f9',
        path: 'M6 1L2 5h2v5h4V5h2z',
    },
    dungeon: {
        kind: 'dungeon',
        label: 'Masmorra / perigo',
        gem: '#431407',
        rim: '#fb923c',
        glyph: '#ffedd5',
        path: 'M4 3h4v2H4zm1 3h2v4H5zm-1 4h4v1H4z',
    },
    harbor: {
        kind: 'harbor',
        label: 'Porto / estaleiro',
        gem: '#0c4a6e',
        rim: '#fcd34d',
        glyph: '#e0f2fe',
        path: 'M6 2v6M4 8h4M3 10h6M8 4l2 2-2 2',
    },
    forge: {
        kind: 'forge',
        label: 'Forja / oficina',
        gem: '#44403c',
        rim: '#fcd34d',
        glyph: '#fef3c7',
        path: 'M2 8h8v2H2zm2-5h4l1 3H3zm2 1v2h2V4z',
    },
    library: {
        kind: 'library',
        label: 'Biblioteca / arquivo',
        gem: '#312e81',
        rim: '#fcd34d',
        glyph: '#e0e7ff',
        path: 'M3 2h2v8H3zm4 0h2v8H7zM3 10h6v1H3z',
    },
    arcane: {
        kind: 'arcane',
        label: 'Torre / observatório',
        gem: '#4c1d95',
        rim: '#c4b5fd',
        glyph: '#ede9fe',
        path: 'M6 1l1 3h2l-2 1.5 1 3.5-2-1.5-2 1.5 1-3.5L3 4h2z',
    },
    camp: {
        kind: 'camp',
        label: 'Acampamento',
        gem: '#365314',
        rim: '#fcd34d',
        glyph: '#ecfccb',
        path: 'M6 2L2 10h8zm0 3l2 3H4z',
    },
    landmark: {
        kind: 'landmark',
        label: 'Marco / local',
        gem: '#57534e',
        rim: '#fcd34d',
        glyph: '#fafaf9',
        path: 'M6 1v8M4 9h4M5 9V6h2v3',
    },
};

export const POI_ICON_LEGEND: PoiIconSpec[] = [
    SPECS.palace,
    SPECS.guild,
    SPECS.tavern,
    SPECS.shop,
    SPECS.temple,
    SPECS.harbor,
    SPECS.forge,
    SPECS.library,
    SPECS.arcane,
    SPECS.dungeon,
    SPECS.camp,
    SPECS.landmark,
];

export function getPoiIconSpec(kind: PoiIconKind): PoiIconSpec {
    return SPECS[kind];
}

/** Infere ícone a partir do slug canônico e tipo do seed. */
export function resolvePoiIconKind(slug: string, poiType?: string | null): PoiIconKind {
    const s = slug.toLowerCase();
    const t = (poiType ?? '').toLowerCase();

    if (t === 'dungeon' || /covil|mina|abismo|tumul|galeria-aberrante|camaras|ninho|portal-fey|entrada-selada/.test(s)) {
        return 'dungeon';
    }
    if (/taverna|estalagem|hammam|cafe-oraculo/.test(s)) return 'tavern';
    if (/guilda|quartel|posto-milicia|posto-escolta|cartorio-contratos/.test(s)) return 'guild';
    if (/mercado|bazar|celeiro|doca-pescadores|mercado-peixe/.test(s)) return 'shop';
    if (/palacio|salao-thane|foro-prismatico/.test(s)) return 'palace';
    if (/templo|capela|santuario|altar|monolito|memorial|enfermaria/.test(s)) return 'temple';
    if (/porto|estaleiro|farol|enseada|ancora|doca|caravansarai/.test(s)) return 'harbor';
    if (/forja|oficina|arsenal/.test(s)) return 'forge';
    if (/biblioteca|academia|celas-estudo/.test(s)) return 'library';
    if (/torre|observatorio|conclave|laboratorio|plataforma-veio|jardim-das-constelacoes/.test(s)) {
        return 'arcane';
    }
    if (/acampamento|refugio|caravana-perdida/.test(s)) return 'camp';
    if (t === 'shop') return 'shop';
    if (t === 'story') return 'landmark';
    return 'landmark';
}

export type PoiMapMarkerModel = {
    slug: string;
    name: string;
    x: number;
    y: number;
    regionSlug: string;
    iconKind: PoiIconKind;
    discovered: boolean;
    visited: boolean;
    isCurrent: boolean;
};
