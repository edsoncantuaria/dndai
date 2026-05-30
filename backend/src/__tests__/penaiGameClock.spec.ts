import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    advanceGameClock,
    defaultGameClock,
    timeOfDayFromHour,
} from '../GameMaster/world/gameClockPenai.js';

describe('penai game clock', () => {
    it('timeOfDayFromHour mapeia períodos do dia', () => {
        assert.equal(timeOfDayFromHour(8), 'Manhã');
        assert.equal(timeOfDayFromHour(14), 'Tarde');
        assert.equal(timeOfDayFromHour(20), 'Entardecer');
        assert.equal(timeOfDayFromHour(2), 'Noite');
    });

    it('advanceGameClock avança horas e dias', () => {
        const start = { day: 1, hour: 20, weather: 'clear' };
        const after = advanceGameClock(start, 6);
        assert.equal(after.day, 2);
        assert.equal(after.hour, 2);
    });

    it('defaultGameClock inicia campanha de manhã', () => {
        const c = defaultGameClock();
        assert.equal(c.day, 1);
        assert.equal(c.hour, 8);
        assert.equal(timeOfDayFromHour(c.hour), 'Manhã');
    });
});
