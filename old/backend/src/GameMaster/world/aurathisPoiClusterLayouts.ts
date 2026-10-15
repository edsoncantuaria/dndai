/**
 * Posições manuais de POIs por região (clusters legíveis no mapa 1100×780).
 * Sobrescreve espiral automática em map:calibrate-pois.
 */
export type PoiCoord = { x: number; y: number };

/** slug POI → coordenada em pixel */
export const AURATHIS_POI_CLUSTER_LAYOUTS: Record<string, Record<string, PoiCoord>> = {
    'cidadela-do-aco-luz': {
        'palacio-prismatico': { x: 292, y: 402 },
        'foro-prismatico': { x: 342, y: 422 },
        'academia-prismatica': { x: 358, y: 398 },
        'templo-menor-ixolar': { x: 255, y: 428 },
        'mercado-anel-solar': { x: 362, y: 452 },
        'oficina-sol-forjado': { x: 322, y: 402 },
        'guilda-dos-auroras': { x: 352, y: 488 },
        'taverna-dragao-azul': { x: 278, y: 492 },
        'estalagem-vigilia-serena': { x: 258, y: 472 },
        'cemiterio-herois-sol': { x: 268, y: 448 },
        'cidadela-do-aco-luz-gate': { x: 372, y: 468 },
    },
    'vila-prata-lua': {
        'moinho-prata-lua': { x: 208, y: 352 },
        'posto-milicia-vale': { x: 248, y: 348 },
        'capela-prata-lua': { x: 232, y: 368 },
        'taverna-tres-colinas': { x: 218, y: 388 },
        'celeiro-coletivo': { x: 238, y: 392 },
    },
    'valdarin-violeta': {
        'torre-conclave-lunar': { x: 548, y: 272 },
        'jardim-das-constelacoes': { x: 588, y: 298 },
        'salas-do-conclave-lunar': { x: 578, y: 318 },
        'bazar-nevoa-violeta': { x: 552, y: 348 },
        'biblioteca-vazia': { x: 518, y: 318 },
        'cafe-oraculo': { x: 532, y: 288 },
        'enclave-fey-lilas': { x: 522, y: 338 },
    },
    'porto-corsario': {
        'palacio-velas': { x: 112, y: 318 },
        'estaleiro-ancora-mestra': { x: 88, y: 358 },
        'taverna-vela-negra': { x: 142, y: 372 },
        'cartorio-contratos': { x: 158, y: 342 },
        'mercado-peixe-sal': { x: 118, y: 388 },
        'doca-pescadores': { x: 98, y: 378 },
    },
    'clareira-conclave-verde': {
        'trono-musgo': { x: 462, y: 498 },
        'circulo-raizes-mae': { x: 492, y: 512 },
        'viveiro-sementes-ancestrais': { x: 508, y: 528 },
        'pocao-cura-viva': { x: 468, y: 538 },
        'arborismo-sagrado': { x: 442, y: 522 },
    },
    'fortaleza-vorngard': {
        'salao-thane': { x: 378, y: 132 },
        'forja-corvo-geada': { x: 408, y: 148 },
        'posto-escolta-mina': { x: 418, y: 118 },
        'templo-anoes-odrun': { x: 352, y: 158 },
        'taverna-gelo-partido': { x: 392, y: 178 },
    },
    'miragem-zahir': {
        'palacio-mil-cupulas': { x: 828, y: 478 },
        'bazar-especiarias': { x: 858, y: 512 },
        'hammam-dourado': { x: 848, y: 528 },
        'caravansarai-leste': { x: 812, y: 502 },
        'jardim-sultao': { x: 792, y: 468 },
    },
    'bastiao-vigia-titanica': {
        'quartel-conselho-veu': { x: 842, y: 188 },
        'arsenal-veu': { x: 878, y: 172 },
        'memorial-expedicoes': { x: 848, y: 228 },
        'enfermaria-campo': { x: 882, y: 208 },
    },
    'selva-de-ashari': {
        'altar-de-lichen': { x: 542, y: 558 },
        'ponte-sussurro': { x: 518, y: 578 },
        'cachoeira-espiritos': { x: 548, y: 602 },
        'acampamento-escolta': { x: 478, y: 562 },
        'ninho-harpias-sul': { x: 512, y: 592 },
    },
    'selvas-de-myr': {
        'santuario-harmonia': { x: 378, y: 488 },
        'clareira-driadas': { x: 418, y: 512 },
        'ruinas-elvenas-myr': { x: 398, y: 528 },
        'acampamento-myr': { x: 432, y: 498 },
    },
    'covil-obsidiano': {
        'camaras-do-nucleo': { x: 318, y: 528 },
        'entrada-selada-dragao': { x: 348, y: 518 },
        'forja-obsidiana': { x: 332, y: 542 },
    },
    'torre-de-aetheryn': {
        'observatorio-primordial': { x: 612, y: 252 },
        'laboratorio-planar': { x: 642, y: 278 },
        'celas-estudo': { x: 628, y: 298 },
    },
    'deserto-coroa-dourada': {
        'oasis-serpente': { x: 868, y: 398 },
        'ruinas-poco-oleo': { x: 898, y: 418 },
        'miragem-falsa': { x: 892, y: 442 },
        'caravana-perdida': { x: 858, y: 438 },
    },
    'planicie-corvos-geada': {
        'acampamento-corvo-branco': { x: 402, y: 58 },
        'refugio-mineradores': { x: 438, y: 78 },
        'tumulo-ancestral-geada': { x: 418, y: 98 },
    },
    'mina-umbra-profunda': {
        'galeria-aberrante': { x: 432, y: 108 },
        'forja-profunda': { x: 462, y: 118 },
        'altar-umbra': { x: 478, y: 142 },
    },
    'passagem-veu-partido': {
        'monolito-ixolar': { x: 928, y: 98 },
        'observatorio-ruina': { x: 958, y: 118 },
        'acampamento-escaladores': { x: 948, y: 142 },
    },
    'tumulos-reis-areia': {
        'sarcofago-rashid-ancestral': { x: 908, y: 362 },
        'antecamara-farao': { x: 932, y: 382 },
        'poco-tesouro-amaldicoado': { x: 918, y: 402 },
    },
    'arquipelago-nove-ilhas': {
        'farol-tempestade': { x: 42, y: 398 },
        'enseada-pirata': { x: 28, y: 428 },
        'mercado-peixe-ilhas': { x: 68, y: 438 },
    },
    'bosque-lilas-perpetuo': {
        'clareira-acordos-fey': { x: 612, y: 232 },
        'lago-lilas': { x: 588, y: 258 },
        'portal-fey-rachado': { x: 622, y: 268 },
    },
    'abismo-veio-arcano': {
        'plataforma-veio-zero': { x: 968, y: 72 },
        'ponte-gravidade': { x: 998, y: 98 },
    },
    // Marcadores de reino (1 POI cada)
    'reino-sol-nascente': { 'marco-fronteira-sol': { x: 268, y: 388 } },
    'dominio-valdar-elfico': { 'obelisco-lua': { x: 502, y: 262 } },
    'confederacao-ashari': { 'totem-cla-unido': { x: 488, y: 558 } },
    'marches-ferro-norte': { 'estela-thane': { x: 348, y: 88 } },
    'sultanato-areias-douradas': { 'poco-oraculo-areia': { x: 772, y: 458 } },
    'republica-nove-ancoras': { 'farol-mestre-ancoras': { x: 72, y: 288 } },
};

export function getManualPoiCoord(
    regionSlug: string,
    poiSlug: string,
): PoiCoord | undefined {
    return AURATHIS_POI_CLUSTER_LAYOUTS[regionSlug]?.[poiSlug];
}
