# Prompt — mapa ilustrado de Aurathis (1:1 com o jogo)

Use este ficheiro ao pedir a uma IA de imagem (ChatGPT, Gemini, Flux, Midjourney, etc.) que **transforme** o SVG técnico em mapa pintado **sem deslocar** cidades, rotas e biomas.

**Ficheiro de referência obrigatório (anexar na conversa):**  
`public/assets/AI/aurathis-continente-v3.svg`

**Canvas fixo:** `1100 × 780 px` · `viewBox="0 0 1100 780"` · origem canto superior esquerdo.

---

## Por que muitas IAs “não parecem mundo de verdade”

Ilustrações estilo “mapa de jogo redondo” (ilha circular, um bioma por fatia, marcos gigantes no centro) são comuns e **bonitas**, mas **não** batem com Aurathis:

| O que a IA costuma fazer | O que Aurathis é no seed |
|--------------------------|---------------------------|
| Um disco/ilha quase circular | **Continente alongado** oeste → leste (costa irregular) |
| Deserto ↔ selva ↔ gelo colados | Faixas climáticas: norte gelo, centro planície/mata, leste deserto, sul selva |
| Hub central (árvore + cratera) | **Várias capitais** nos nós do JSON (Cidadela, Porto, Valdarin, Zahir…) |
| Arquipélago genérico | **Costa oeste** (República) + ilhas em `x≈60–150`, não anel em volta do hub |
| Sem escala de viagem | **64 rotas** em dias/semanas — o mapa deve “parecer grande” |

**Regra:** o SVG v3 é a planta; a IA só **pinta por cima**, não redesenha a geografia. Se ignorar o anexo, volta o “mundo de parque temático”.

**Workflow que preserva realismo:** gerar só **texturas/biomas** com opacidade baixa sobre o v3 no Figma/Photoshop, ou usar Image-to-Image com **peso alto** no SVG de referência (ControlNet / “structure”, 70–85%).

---

## Fluxo recomendado (2 camadas)

| Camada | Conteúdo | Quem gera |
|--------|----------|-----------|
| **Fundo** | Continente pintado (mar, gelo, deserto, selva, névoa élfica, Véu) | IA de imagem (prompt abaixo) |
| **Rotas + UI** | Linhas de viagem, marcadores do jogo | Jogo (SVG/TS) — **não** redesenhar rotas na ilustração |

Depois de gerar o fundo:

1. Exportar **exatamente** 1100×780 (sem margens, sem crop).
2. Guardar como `public/assets/AI/aurathis-continente-v4.png` (ou SVG pintado com o mesmo viewBox).
3. Atualizar `regionsSeed.json` → `aurathis.metadata.mapArt.url` (e `version: 4`).
4. Atualizar fallback em `src/lib/aurathisMapArt.ts`.
5. **Não** é preciso `seed:penai-world` só por trocar a imagem.
6. Se moveres uma cidade no desenho, ajusta o par `x,y` em `mapLayout.nodes` (ver tabela no fim).

Para **repor as rotas canónicas** por cima de um fundo novo (opcional, decorativo):

```bash
npm run map:generate-aurathis --prefix backend
```

(Isto regera o SVG técnico v3 com `#canon-routes`; podes compor no Figma: fundo IA + grupo de rotas exportado do v3.)

---

## Prompt principal (inglês — colar na IA de imagem)

Anexa `aurathis-continente-v3.svg` como imagem de referência / control map.

```
TASK: Turn the attached technical SVG into a single polished fantasy world map illustration for a D&D-style game UI overlay. The output MUST remain pixel-aligned to the reference: canvas exactly 1100 pixels wide by 780 pixels tall, same continent shape and geography, same relative positions of all anchor points.

REFERENCE RULES (critical — do not violate):
- Use the attached SVG as the ground-truth layout: coastlines, biome blobs, and especially every line in group #canon-routes and every point in #map-anchors must stay in the same pixel coordinates after your render.
- Do NOT add new cities, roads, or labels that are not in the reference.
- Do NOT crop, rotate, or rescale the map. No decorative border that changes the 1100×780 content area.
- Remove or paint over the technical route lines (#canon-routes) and anchor dots (#map-anchors) in the final art — the game draws interactive routes on top in code.
- Keep eight capital diamond markers (losangos) at the same positions as in #capital-markers if visible, or leave subtle unmarked terrain at those exact pixels: (310,450), (130,350), (560,310), (840,500), (390,150), (480,520), (220,370), (860,200).

GEOGRAPHY — MUST NOT look like a circular island or radial “pie slices”:
- One MAIN CONTINENT with irregular coastline (wider east-west than north-south), not a perfect disc.
- Gradual biome transitions: foothills between snow and plains; dry scrub between plains and desert; river corridors into jungle.
- Scale: travel between cities takes days — cities are small on the map; no single giant tree/crater dominating the entire center.
- WEST: separate small islands OFF the mainland coast (not a ring around the continent).
- Match the reference SVG land silhouette and biome blob positions exactly.

CONTINENT — AURATHIS (one landmass in dark ocean):
- WEST: island republic archipelago (cold teal sea, small islands ~x 60–150, y 300–430).
- NORTHWEST-CENTER: snowy iron marches and glaciers (pale blue-grey, ~x 360–450, y 80–180).
- WEST-CENTER: fertile human kingdom “Sun Rising” — green plains and rivers (~x 220–340, y 350–480); capital citadel at anchor (310,450).
- CENTER: elven violet mist domain (~x 480–600, y 240–340); magical purple haze, silver forests.
- SOUTH-CENTER: Ashari confederation — deep jungle and rivers (~x 380–560, y 480–600).
- EAST: golden desert sultanate — dunes, oases, warm gold (~x 740–920, y 380–520); mirage city at (840,500).
- NORTHEAST: Titan Veil frontier — ominous dark plateau, storm clouds, arcane rift (~x 850–1000, y 40–220).
- Rivers: subtle blue veins matching reference paths (decorative only).

ART DIRECTION:
- Painterly fantasy map, aged parchment feel mixed with deep ocean blues (not modern satellite).
- Readable biomes at game zoom; soft coast vignette; no text labels (game adds UI text).
- Lighting: top-left sun; gentle elevation shading on mountains north and east.
- Color palette: ocean #0b1524–#030810, forests #2a4530–#3f5c3a, desert #8b6914–#d4b85a, snow #4a5d6e–#c5d4e0, jungle #0d3a22–#1a5c38, fey mist #5c4a7a–#7c6aaa, veil #2d2840.
- Style: high-detail illustration suitable for dark UI overlay at 90% opacity — avoid pure white backgrounds.

OUTPUT:
- One flat image 1100×780 px, PNG or SVG with viewBox="0 0 1100 780".
- No text, no legend, no compass rose unless extremely faint and corner-only.
```

---

## Prompt negativo (adicionar se a ferramenta suportar)

```
circular island, round world disc, radial biome slices, theme park layout, one landmark per slice, giant central tree dominating map, perfect symmetry, abrupt desert touching jungle, no rivers, floating islands ring, single volcano hub, video game level select, text labels, typography, modern satellite map, 3D render, isometric, rotated map, cropped edges, white margins, extra continents, blurry, watermark
```

---

## Prompt curto (português — Gemini / ChatGPT com SVG anexo)

```
Transforma o SVG anexo no mapa ilustrado do continente fantasia Aurathis.

Regras obrigatórias:
- Saída exata: 1100×780 px, mesma proporção e posição de costas e biomas do SVG.
- Os pontos de #map-anchors (27 círculos) e as capitais nos losangos NÃO podem mudar de lugar no canvas — o jogo sobrepõe marcadores nessas coordenadas.
- Apaga ou pinta por cima das linhas de #canon-routes (rotas ficam no código do jogo).
- Biomas: oeste = ilhas e porto; noroeste = gelo (Marches); centro-oeste = planícies verdes (Reino do Sol); centro = névoa violeta élfica; sul = selva Ashari; leste = deserto dourado; nordeste = platô sombrio (Véu Titânico).
- Estilo: mapa de RPG pintado, pergaminho envelhecido + oceano escuro, sem texto, sem bordas que alterem o tamanho útil.
- Não inventar cidades nem estradas novas.
- PROIBIDO: ilha circular única, biomas em fatias ao redor de um centro, marcos gigantes no meio do mapa.
- OBRIGATÓRIO: continente irregular como no SVG; transições suaves entre climas; escala grande (cidades pequenas).
```

### Prompt “realismo geográfico” (adicional — colar depois do principal)

```
The landmass must read as a REAL continent on a fantasy planet: irregular fractal coastline, latitudinal climate bands (arctic north, temperate west-center, arid east, tropical south), river valleys visible as thin blue lines, mountain ranges as continuous chains not isolated mesas. Avoid game-hub composition. The attached SVG silhouette is law — paint inside it only.
```

---

## Prompt para “só melhorar o SVG” (vector, mesma geometria)

Ferramentas que editam SVG (Illustrator, Figma, Inkscape + IA):

```
Beautify the attached game map SVG: keep viewBox="0 0 1100 780" and all path/line coordinates unchanged. Replace flat fills with painterly gradients and textured coastlines. Style #canon-routes as faint hand-drawn trails (lower opacity). Hide #map-anchors. Preserve #capital-markers positions. Export as SVG 1100×780.
```

---

## Geografia canônica (lore — para a IA não inventar)

| Região (âncora) | x,y | Bioma / nota |
|-----------------|-----|----------------|
| reino-sol-nascente | 280,400 | Planícies, monarquia humana |
| dominio-valdar-elfico | 520,280 | Névoa violeta, torres élficas |
| confederacao-ashari | 500,540 | Selva, confederação druida |
| marches-ferro-norte | 360,100 | Gelo, montanhas, thane |
| sultanato-areias-douradas | 800,460 | Deserto, sultão |
| republica-nove-ancoras | 90,300 | Costa oeste, ilhas |
| fronteira-veu-titanico | 900,160 | Fronteira arcana leste |
| cidadela-do-aco-luz | 310,450 | Capital solar (spawn intro) |
| vila-prata-lua | 220,370 | Vale agrícola (spawn intro) |
| porto-corsario | 130,350 | Porto corsário (spawn intro) |
| valdarin-violeta | 560,310 | Cidade élfica |
| clareira-conclave-verde | 480,520 | Conclave druida |
| fortaleza-vorngard | 390,150 | Fortaleza de gelo |
| miragem-zahir | 840,500 | Cidade-oásis |
| bastiao-vigia-titanica | 860,200 | Bastão do Véu |
| selva-de-ashari | 530,580 | Selva profunda |
| selvas-de-myr | 400,500 | Selva Myr |
| bosque-lilas-perpetuo | 600,250 | Bosque feérico |
| planicie-corvos-geada | 420,80 | Planície gelada |
| deserto-coroa-dourada | 880,420 | Dunas interiores |
| arquipelago-nove-ilhas | 60,420 | Ilhas |
| passagem-veu-partido | 940,120 | Passagem do Véu |
| covil-obsidiano | 340,520 | Covil dragão |
| torre-de-aetheryn | 620,270 | Torre arcana |
| mina-umbra-profunda | 450,130 | Mina umbra |
| tumulos-reis-areia | 920,380 | Tumulos |
| abismo-veio-arcano | 980,90 | Abismo arcano |

**POIs** (33 marcadores rosados no jogo): coordenadas em `regionsSeed.json` → `mapLayout.pois` (agrupados perto das cidades acima).

**Rotas de jogo:** 64 arestas únicas entre estes nós (ver `#canon-routes` no v3). Modos: estrada, montaria, navio, dirigível, portal — o cliente desenha por cima quando a região é descoberta.

---

## Checklist pós-geração

- [ ] Ficheiro final mede **1100×780** px (verificar propriedades da imagem).
- [ ] Sobrepor `aurathis-continente-v3.svg` a 50% de opacidade no editor: losangos das capitais coincidem com o desenho.
- [ ] Pelo menos 3 âncoras de teste: Cidadela (310,450), Porto (130,350), Miragem (840,500).
- [ ] `mapArt.url` atualizado; hard refresh no browser.
- [ ] Se deslocaste um ponto: editar `mapLayout.nodes` no JSON, **não** só a imagem.
- [ ] Rotas no jogo continuam corretas (vêm do seed/DB, não da ilustração).

---

## Ficheiros do projeto

| Ficheiro | Função |
|----------|--------|
| `public/assets/AI/aurathis-continente-v3.svg` | Referência técnica + rotas |
| `backend/src/data/regionsSeed.json` | Grafo, nós, POIs, `mapArt` |
| `backend/scripts/generateAurathisMapSvg.ts` | Regenera SVG de rotas |
| `docs/AURATHIS_MAP_OVERLAY.md` | Sistema 1:1 |

Ver também: `.cursor/rules/ai-generated-images.mdc` — assets finais em `public/assets/AI/`.
