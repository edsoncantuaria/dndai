import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deriveAmbientSoundFromWorld } from '../hooks/game/ambientSound.ts';

describe('deriveAmbientSoundFromWorld', () => {
    it('escolhe trilha costeira em região marítima', () => {
        const sound = deriveAmbientSoundFromWorld({
            currentRegion: 'Porto Corsário',
            regionSlug: 'porto-corsario',
            environmentTags: ['city', 'oceano', 'agua', 'porto', 'costa'],
        });
        assert.ok(['down_by_the_sea', 'docks_district', 'age_of_sail'].includes(sound));
    });

    it('escolhe trilha de taverna quando o POI é uma estalagem', () => {
        const sound = deriveAmbientSoundFromWorld({
            currentRegion: 'Porto Corsário',
            poiSlug: 'taverna-vela-negra',
            poiName: 'Taverna Vela Negra',
            environmentTags: ['taverna', 'social', 'interior'],
        });
        assert.ok(['the_slaughtered_ox', 'mountain_tavern', 'lively_cafe'].includes(sound));
    });

    it('escolhe trilha de caverna em masmorra', () => {
        const sound = deriveAmbientSoundFromWorld({
            currentRegion: 'Mina Perdida',
            regionType: 'dungeon',
            poiName: 'Caverna dos Goblins',
            environmentTags: ['caverna', 'masmorra', 'subterraneo'],
        });
        assert.ok(
            ['goblins_cave', 'dungeon_i', 'lost_mine', 'into_the_deep'].includes(sound),
        );
    });
});
