/**
 * Gera aurathis-continente-v3.svg a partir de regionsSeed.json (nós + rotas canônicas).
 * Uso: npm run map:generate-aurathis --prefix backend
 */
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import regionGraph from '../src/data/regionsSeed.json' with { type: 'json' };
import type { RegionGraphPayload } from '../src/schemas/regionSchemas.js';

const graph = regionGraph as RegionGraphPayload;
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../../public/assets/AI/aurathis-continente-v3.svg');

const world = graph.regions.find(r => r.slug === 'aurathis');
const layout = world?.metadata?.mapLayout as
    | {
          canvas?: { width: number; height: number };
          nodes?: Record<string, { x: number; y: number }>;
      }
    | undefined;

const nodes = layout?.nodes ?? {};
const W = layout?.canvas?.width ?? 1100;
const H = layout?.canvas?.height ?? 780;

const SKIP_ROUTE_SLUGS = new Set(['aurathis']);

type LinkRow = (typeof graph.links)[number];

function pos(slug: string): { x: number; y: number } | null {
    const p = nodes[slug];
    return p ? { x: p.x, y: p.y } : null;
}

function routeStyle(link: LinkRow): {
    stroke: string;
    width: number;
    opacity: number;
    dash?: string;
} {
    if (link.isLocked) {
        return { stroke: '#b45309', width: 2.2, opacity: 0.55, dash: '10 7' };
    }
    const mode = link.travelMode ?? 'walk';
    const diff = link.difficulty ?? 'média';
    const thick = diff === 'alta' ? 2.4 : diff === 'média' ? 1.9 : 1.5;
    const baseOpacity = diff === 'alta' ? 0.42 : diff === 'média' ? 0.36 : 0.32;
    switch (mode) {
        case 'ship':
            return { stroke: '#5b9eb8', width: thick, opacity: baseOpacity + 0.06, dash: '7 9' };
        case 'airship':
            return { stroke: '#d4a84b', width: 1.4, opacity: 0.38, dash: '4 8' };
        case 'portal':
            return { stroke: '#a78bfa', width: 1.6, opacity: 0.45, dash: '3 6' };
        case 'mount':
            return { stroke: '#9a7b4f', width: thick, opacity: baseOpacity, dash: '5 7' };
        default:
            return { stroke: '#7d6b4a', width: thick, opacity: baseOpacity };
    }
}

const edgeMap = new Map<string, LinkRow>();
for (const link of graph.links ?? []) {
    if (SKIP_ROUTE_SLUGS.has(link.fromSlug) || SKIP_ROUTE_SLUGS.has(link.toSlug)) continue;
    const a = link.fromSlug;
    const b = link.toSlug;
    const key = [a, b].sort().join('::');
    if (!edgeMap.has(key)) edgeMap.set(key, link);
}

const routeLines: string[] = [];
for (const link of edgeMap.values()) {
    const from = pos(link.fromSlug);
    const to = pos(link.toSlug);
    if (!from || !to) {
        console.warn(`[map] rota sem nó: ${link.fromSlug} → ${link.toSlug}`);
        continue;
    }
    const s = routeStyle(link);
    const dash = s.dash ? ` stroke-dasharray="${s.dash}"` : '';
    routeLines.push(
        `    <line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${s.stroke}" stroke-width="${s.width}" stroke-linecap="round" opacity="${s.opacity}"${dash}/>`,
    );
}

const anchorDots = Object.entries(nodes)
    .map(
        ([slug, p]) =>
            `    <circle cx="${p.x}" cy="${p.y}" r="2.5" data-slug="${slug}" fill="#fbbf24" opacity="0.12"/>`,
    )
    .join('\n');

const kingdomLabels: Array<{ slug: string; label: string; x: number; y: number }> = [
    { slug: 'reino-sol-nascente', label: 'Reino do Sol Nascente', x: 268, y: 418 },
    { slug: 'dominio-valdar-elfico', label: 'Domínio Valdar', x: 518, y: 258 },
    { slug: 'confederacao-ashari', label: 'Confederação Ashari', x: 498, y: 558 },
    { slug: 'marches-ferro-norte', label: 'Marches do Ferro', x: 348, y: 78 },
    { slug: 'sultanato-areias-douradas', label: 'Areias Douradas', x: 788, y: 478 },
    { slug: 'republica-nove-ancoras', label: 'Nove Âncoras', x: 78, y: 278 },
    { slug: 'fronteira-veu-titanico', label: 'Véu Titânico', x: 888, y: 138 },
];

const cityMarkers = [
    'cidadela-do-aco-luz',
    'porto-corsario',
    'valdarin-violeta',
    'miragem-zahir',
    'fortaleza-vorngard',
    'clareira-conclave-verde',
    'vila-prata-lua',
    'bastiao-vigia-titanica',
]
    .map(slug => {
        const p = pos(slug);
        if (!p) return '';
        return `    <g transform="translate(${p.x},${p.y})"><polygon points="0,-5 4,0 0,5 -4,0" fill="#f5e6c8" stroke="#c9a227" stroke-width="1" opacity="0.75"/></g>`;
    })
    .join('\n');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Aurathis v3 — gerado por generateAurathisMapSvg.ts; viewBox 0 0 ${W} ${H} -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mapa do continente Aurathis">
  <defs>
    <linearGradient id="ocean" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b1524"/>
      <stop offset="100%" stop-color="#030810"/>
    </linearGradient>
    <linearGradient id="land-base" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#3f5c3a"/>
      <stop offset="55%" stop-color="#2a4530"/>
      <stop offset="100%" stop-color="#1a2e22"/>
    </linearGradient>
    <linearGradient id="snow" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#4a5d6e"/>
      <stop offset="100%" stop-color="#c5d4e0"/>
    </linearGradient>
    <linearGradient id="desert" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8b6914"/>
      <stop offset="100%" stop-color="#d4b85a"/>
    </linearGradient>
    <linearGradient id="jungle" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1a5c38"/>
      <stop offset="100%" stop-color="#0d3a22"/>
    </linearGradient>
    <radialGradient id="fey-mist" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#7c6aaa" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#5c4a7a" stop-opacity="0"/>
    </radialGradient>
    <filter id="coast-soft">
      <feGaussianBlur stdDeviation="2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#ocean)"/>

  <!-- Arquipélago oeste -->
  <path fill="#1a3348" opacity="0.85" d="M 8 395 L 52 365 L 68 430 L 28 455 Z"/>
  <path fill="#1a3348" opacity="0.7" d="M 42 320 L 88 300 L 95 360 L 55 375 Z"/>

  <!-- Massa continental (contorno calibrado aos nós) -->
  <path fill="url(#land-base)" stroke="#1e3d28" stroke-width="2.5" filter="url(#coast-soft)"
    d="M 75 250 L 175 185 L 290 130 L 400 95 L 520 88 L 640 105 L 750 140 L 850 185 L 930 240 L 990 310 L 1020 395 L 1005 480 L 935 560 L 820 610 L 680 640 L 520 655 L 380 640 L 250 600 L 150 540 L 85 460 L 58 370 L 62 290 Z"/>

  <!-- Biomas por jurisdição (elipses nos nós dos reinos) -->
  <ellipse cx="280" cy="400" rx="175" ry="120" fill="#3d6b42" opacity="0.45"/>
  <ellipse cx="520" cy="280" rx="140" ry="95" fill="url(#fey-mist)" opacity="0.7"/>
  <ellipse cx="500" cy="540" rx="200" ry="105" fill="url(#jungle)" opacity="0.88"/>
  <ellipse cx="360" cy="100" rx="130" ry="75" fill="url(#snow)" opacity="0.9"/>
  <ellipse cx="800" cy="460" rx="170" ry="115" fill="url(#desert)" opacity="0.9"/>
  <path fill="#2a4d62" opacity="0.75" d="M 55 285 L 145 265 L 160 365 L 75 385 Z"/>
  <path fill="#2d2840" opacity="0.88" stroke="#7c6aaa" stroke-width="1.5" stroke-dasharray="10 6"
    d="M 820 48 L 1045 35 L 1075 175 L 935 205 L 865 125 Z"/>

  <!-- Planícies e vales -->
  <ellipse cx="265" cy="380" rx="95" ry="70" fill="#4a7a4e" opacity="0.35"/>
  <ellipse cx="420" cy="420" rx="110" ry="65" fill="#356040" opacity="0.3"/>

  <!-- Rios (decorativo, não rotas de jogo) -->
  <g fill="none" stroke="#3d7ab8" stroke-width="2" opacity="0.35" stroke-linecap="round">
    <path d="M 310 450 Q 280 320 250 200"/>
    <path d="M 310 450 Q 400 480 480 520"/>
    <path d="M 560 310 Q 520 400 500 540"/>
    <path d="M 130 350 Q 220 400 310 450"/>
    <path d="M 840 500 Q 780 440 720 380"/>
  </g>

  <!-- Rotas canônicas (${edgeMap.size} arestas do regionsSeed.json) -->
  <g id="canon-routes" aria-label="Rotas de viagem canônicas">
${routeLines.join('\n')}
  </g>

  <!-- Capitais (losangos nas âncoras) -->
  <g id="capital-markers" opacity="0.8">
${cityMarkers}
  </g>

  <!-- Rótulos dos reinos -->
  <g font-family="Georgia, 'Times New Roman', serif" font-size="11" fill="#e8dcc8" opacity="0.72" text-anchor="middle">
${kingdomLabels.map(k => `    <text x="${k.x}" y="${k.y}">${k.label}</text>`).join('\n')}
  </g>

  <text x="550" y="24" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#94a3b8" opacity="0.5" letter-spacing="0.2em">AURATHIS</text>

  <!-- Legenda de modos de viagem -->
  <g transform="translate(24,680)" font-family="system-ui,sans-serif" font-size="9" fill="#94a3b8" opacity="0.65">
    <line x1="0" y1="0" x2="28" y2="0" stroke="#7d6b4a" stroke-width="2"/><text x="34" y="4">estrada</text>
    <line x1="0" y1="14" x2="28" y2="14" stroke="#9a7b4f" stroke-width="2" stroke-dasharray="5 7"/><text x="34" y="18">montaria</text>
    <line x1="0" y1="28" x2="28" y2="28" stroke="#5b9eb8" stroke-width="2" stroke-dasharray="7 9"/><text x="34" y="32">navio</text>
    <line x1="120" y1="0" x2="148" y2="0" stroke="#d4a84b" stroke-width="1.4" stroke-dasharray="4 8"/><text x="154" y="4">dirigível</text>
    <line x1="120" y1="14" x2="148" y2="14" stroke="#a78bfa" stroke-width="1.6" stroke-dasharray="3 6"/><text x="154" y="18">portal</text>
    <line x1="120" y1="28" x2="148" y2="28" stroke="#b45309" stroke-width="2" stroke-dasharray="10 7"/><text x="154" y="32">bloqueada</text>
  </g>

  <rect x="6" y="6" width="1088" height="768" fill="none" stroke="#334155" stroke-width="1.5" opacity="0.35" rx="3"/>

  <!-- Âncoras mapLayout.nodes (calibração) -->
  <g id="map-anchors">
${anchorDots}
  </g>
</svg>
`;

writeFileSync(OUT, svg, 'utf8');
console.log(`[map] escrito ${OUT} — ${edgeMap.size} rotas, ${Object.keys(nodes).length} nós`);
