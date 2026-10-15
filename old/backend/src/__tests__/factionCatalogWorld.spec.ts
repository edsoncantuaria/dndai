import test from 'node:test';
import assert from 'node:assert/strict';
import regionGraph from '../data/regionsSeed.json' with { type: 'json' };
import {
    FACTION_CATALOG,
    findFactionsByPoiSlug,
    findFactionsByRegionSlug,
    getFactionDiscoveryPoiSlugs,
    describeFactionWorldBindings,
} from '../GameMaster/world/factionCatalog.js';

const poiSlugs = new Set((regionGraph.pois ?? []).map(p => p.slug));

test('mapLayout.pois cobre todos os POIs do seed', () => {
    const world = regionGraph.regions.find(r => r.slug === 'aurathis');
    const layoutPois = (world?.metadata as { mapLayout?: { pois?: Record<string, unknown> } })?.mapLayout
        ?.pois;
    assert.equal((regionGraph.pois ?? []).length, 93);
    assert.equal(Object.keys(layoutPois ?? {}).length, 93);
});

test('catálogo tem 10 facções com sede e POIs no seed', () => {
    assert.equal(FACTION_CATALOG.length, 10);
    for (const entry of FACTION_CATALOG) {
        assert.ok(entry.headquarters.regionSlug, entry.slug);
        assert.ok(
            poiSlugs.has(entry.headquarters.poiSlug),
            `${entry.slug} HQ poi ${entry.headquarters.poiSlug}`,
        );
        for (const poi of getFactionDiscoveryPoiSlugs(entry)) {
            assert.ok(poiSlugs.has(poi), `${entry.slug} poi inexistente: ${poi}`);
        }
    }
});

test('findFactionsByPoi e região', () => {
    const atGuild = findFactionsByPoiSlug('guilda-dos-auroras');
    assert.ok(atGuild.some(f => f.slug === 'guilda-aventureiros'));
    const inCidadela = findFactionsByRegionSlug('cidadela-do-aco-luz');
    assert.ok(inCidadela.some(f => f.slug === 'coroa-ferro'));
    assert.ok(inCidadela.some(f => f.slug === 'guilda-aventureiros'));
});

test('describeFactionWorldBindings expõe placements', () => {
    const rows = describeFactionWorldBindings();
    assert.equal(rows.length, 10);
    const sombra = rows.find(r => r.slug === 'gremio-sombra');
    assert.ok(sombra?.headquarters.poiSlug === 'taverna-vela-negra');
    assert.ok((sombra?.notableNpcs.length ?? 0) >= 1);
});
