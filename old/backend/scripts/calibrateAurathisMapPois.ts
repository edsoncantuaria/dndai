/**
 * Preenche mapLayout.pois para todos os POIs do regionsSeed.json.
 * Mantém coordenadas existentes; posiciona faltantes em espiral a partir do nó da região.
 *
 * Uso: npm run map:calibrate-pois --prefix backend
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { RegionGraphPayload } from '../src/schemas/regionSchemas.js';
import { AURATHIS_POI_CLUSTER_LAYOUTS } from '../src/GameMaster/world/aurathisPoiClusterLayouts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(__dirname, '../src/data/regionsSeed.json');

const slugify = (value: string): string =>
    value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const CANVAS = { w: 1100, h: 780 };
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(v)));

type Vec = { x: number; y: number };

function dist(a: Vec, b: Vec): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Preferência angular por categoria (graus → rad). */
function preferredAngle(slug: string, poiType: string): number {
    const s = slug.toLowerCase();
    if (/palacio|salao-thane|foro/.test(s)) return -Math.PI / 2;
    if (/taverna|estalagem|hammam|cafe/.test(s)) return Math.PI / 4;
    if (/templo|capela|santuario|altar|memorial|monolito/.test(s)) return -Math.PI / 4;
    if (/mercado|bazar|celeiro|cartorio|doca/.test(s)) return Math.PI / 2;
    if (/guilda|quartel|posto-milicia|posto-escolta|arsenal/.test(s)) return Math.PI;
    if (/forja|oficina|mina|galeria/.test(s)) return -Math.PI / 3;
    if (/porto|estaleiro|farol|enseada|ancora/.test(s)) return (Math.PI * 5) / 6;
    if (/torre|observatorio|biblioteca|academia|laboratorio/.test(s)) return -Math.PI / 6;
    if (poiType === 'dungeon' || /covil|abismo|tumul|ninho|entrada-selada|camaras/.test(s)) {
        return (Math.PI * 2) / 3;
    }
    if (/acampamento|refugio|caravana/.test(s)) return Math.PI / 3;
    return 0;
}

function spiralCandidate(
    anchor: Vec,
    index: number,
    baseRadius: number,
    preferred: number,
): Vec {
    const golden = 2.399963;
    const angle = preferred + index * golden * 0.35;
    const r = baseRadius + 7 * Math.sqrt(index + 1);
    return {
        x: anchor.x + Math.cos(angle) * r,
        y: anchor.y + Math.sin(angle) * r,
    };
}

function run(): void {
    const raw = readFileSync(SEED_PATH, 'utf8');
    const graph = JSON.parse(raw) as RegionGraphPayload & {
        regions: Array<{ slug?: string; metadata?: Record<string, unknown> }>;
    };

    const world = graph.regions.find(r => r.slug === 'aurathis');
    if (!world?.metadata) throw new Error('aurathis world entry missing');

    const layout = world.metadata.mapLayout as {
        nodes: Record<string, Vec>;
        pois?: Record<string, Vec & { regionSlug?: string }>;
    };
    const nodes = layout.nodes;

    // Normalizar chaves existentes (taverna-três-colinas → taverna-tres-colinas)
    const existing: Record<string, Vec & { regionSlug: string }> = {};
    for (const [key, pos] of Object.entries(layout.pois ?? {})) {
        const slug = slugify(key);
        existing[slug] = {
            x: pos.x,
            y: pos.y,
            regionSlug: pos.regionSlug ?? '',
        };
    }

    const placed: Vec[] = Object.values(existing).map(p => ({ x: p.x, y: p.y }));
    const result: Record<string, { x: number; y: number; regionSlug: string }> = { ...existing };

    const byRegion = new Map<string, typeof graph.pois>();
    for (const poi of graph.pois ?? []) {
        const rs = slugify(poi.regionSlug);
        const list = byRegion.get(rs) ?? [];
        list.push(poi);
        byRegion.set(rs, list);
    }

    for (const [regionSlug, pois] of byRegion) {
        const anchor = nodes[regionSlug];
        if (!anchor) {
            console.warn(`[calibrate] região sem nó no mapLayout: ${regionSlug}`);
            continue;
        }

        const baseRadius =
            pois.length > 10 ? 14 : pois.length > 6 ? 12 : pois.length > 3 ? 10 : 8;

        let spiralIdx = 0;
        for (const poi of pois) {
            const slug = slugify(poi.slug || poi.name);
            if (!slug) continue;

            const manual = AURATHIS_POI_CLUSTER_LAYOUTS[regionSlug]?.[slug];
            if (manual) {
                const x = clamp(manual.x, 20, CANVAS.w - 20);
                const y = clamp(manual.y, 20, CANVAS.h - 20);
                result[slug] = { x, y, regionSlug };
                placed.push({ x, y });
                continue;
            }

            if (result[slug]) {
                result[slug].regionSlug = regionSlug;
                continue;
            }

            const pref = preferredAngle(slug, poi.type ?? 'landmark');
            let chosen: Vec | null = null;

            for (let attempt = 0; attempt < 100; attempt++) {
                const cand = spiralCandidate(anchor, spiralIdx + attempt, baseRadius, pref);
                const x = clamp(cand.x, 20, CANVAS.w - 20);
                const y = clamp(cand.y, 20, CANVAS.h - 20);
                const minD = Math.min(...placed.map(p => dist({ x, y }, p)), Infinity);
                if (minD >= 9) {
                    chosen = { x, y };
                    spiralIdx += attempt + 1;
                    break;
                }
            }

            if (!chosen) {
                const fallback = spiralCandidate(anchor, spiralIdx++, baseRadius + 10, pref);
                chosen = {
                    x: clamp(fallback.x, 20, CANVAS.w - 20),
                    y: clamp(fallback.y, 20, CANVAS.h - 20),
                };
            }

            result[slug] = { x: chosen.x, y: chosen.y, regionSlug };
            placed.push(chosen);
        }
    }

    // Slugs canônicos no array pois (acentos)
    for (const poi of graph.pois ?? []) {
        const canonical = slugify(poi.slug || poi.name);
        if (canonical && poi.slug !== canonical) {
            poi.slug = canonical;
        }
        poi.regionSlug = slugify(poi.regionSlug);
    }

    const sortedEntries = Object.entries(result).sort(([a], [b]) => a.localeCompare(b));
    const poisOut: Record<string, { x: number; y: number; regionSlug: string }> = {};
    for (const [slug, pos] of sortedEntries) {
        poisOut[slug] = pos;
    }

    layout.pois = poisOut;
    world.metadata.mapLayout = layout;

    writeFileSync(SEED_PATH, `${JSON.stringify(graph, null, 2)}\n`, 'utf8');

    const seedSlugs = new Set((graph.pois ?? []).map(p => slugify(p.slug || p.name)));
    const layoutSlugs = new Set(Object.keys(poisOut));
    const missing = [...seedSlugs].filter(s => !layoutSlugs.has(s));
    const extra = [...layoutSlugs].filter(s => !seedSlugs.has(s));

    console.log(`[calibrate] POIs no seed: ${seedSlugs.size}`);
    console.log(`[calibrate] POIs no mapLayout: ${layoutSlugs.size}`);
    if (missing.length) console.warn('[calibrate] faltando:', missing);
    if (extra.length) console.warn('[calibrate] extras:', extra);
    console.log('[calibrate] regionsSeed.json atualizado.');
}

run();
