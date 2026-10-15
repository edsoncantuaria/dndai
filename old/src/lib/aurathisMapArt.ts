/**
 * Arte do continente Aurathis — coordenadas 1:1 com regionsSeed.json → metadata.mapLayout.
 * Substituir a imagem mantendo width/height iguais para sobreposição perfeita dos marcadores.
 */

export const AURATHIS_MAP_CANVAS = { width: 1100, height: 780 } as const;

export const AURATHIS_MAP_ART = {
  url: '/assets/AI/aurathis-continente-v4.png',
  width: AURATHIS_MAP_CANVAS.width,
  height: AURATHIS_MAP_CANVAS.height,
  version: 4,
} as const;

export type MapArtMeta = {
  url: string;
  width: number;
  height: number;
  version?: number;
};

export type MapLayoutMeta = {
  canvas?: { width: number; height: number };
  coordinateSpace?: 'pixel';
  nodes?: Record<string, { x: number; y: number }>;
};

export function resolveAurathisMapArt(metadata?: Record<string, unknown> | null): MapArtMeta {
  const art = metadata?.mapArt as MapArtMeta | undefined;
  if (art?.url && art.width && art.height) return art;
  return AURATHIS_MAP_ART;
}

export function resolveAurathisMapLayout(metadata?: Record<string, unknown> | null): {
  canvas: { width: number; height: number };
  nodes: Record<string, { x: number; y: number }>;
} {
  const layout = metadata?.mapLayout as MapLayoutMeta | undefined;
  return {
    canvas: {
      width: layout?.canvas?.width ?? AURATHIS_MAP_CANVAS.width,
      height: layout?.canvas?.height ?? AURATHIS_MAP_CANVAS.height,
    },
    nodes: layout?.nodes ?? {},
  };
}
