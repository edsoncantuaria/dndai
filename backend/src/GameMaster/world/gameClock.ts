import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';

export type PenaiGameClock = {
    day: number;
    hour: number;
    weather: string;
};

export type PenaiWorldStateView = {
    timeOfDay: string;
    weather: string;
    currentRegion: string | null;
    location: string | null;
    gameClock: PenaiGameClock;
};

const WEATHER_CYCLE = ['clear', 'cloudy', 'rain', 'fog', 'wind'] as const;

export function defaultGameClock(): PenaiGameClock {
    return { day: 1, hour: 8, weather: 'clear' };
}

export function timeOfDayFromHour(hour: number): string {
    const h = ((hour % 24) + 24) % 24;
    if (h >= 5 && h < 12) return 'Manhã';
    if (h >= 12 && h < 18) return 'Tarde';
    if (h >= 18 && h < 22) return 'Entardecer';
    return 'Noite';
}

export function parseGameClock(raw: Record<string, unknown> | null | undefined): PenaiGameClock {
    const base = defaultGameClock();
    if (!raw) return base;
    return {
        day: typeof raw.day === 'number' && raw.day >= 1 ? Math.floor(raw.day) : base.day,
        hour:
            typeof raw.hour === 'number' && raw.hour >= 0 && raw.hour <= 23
                ? Math.floor(raw.hour)
                : base.hour,
        weather: typeof raw.weather === 'string' && raw.weather.trim() ? raw.weather : base.weather,
    };
}

export function buildWorldStateView(
    clock: PenaiGameClock,
    regionSlug: string | null,
    regionDisplayName?: string | null,
): PenaiWorldStateView {
    const label = regionDisplayName ?? regionSlug ?? null;
    return {
        timeOfDay: timeOfDayFromHour(clock.hour),
        weather: clock.weather,
        currentRegion: label,
        location: label,
        gameClock: clock,
    };
}

function maybeRotateWeather(clock: PenaiGameClock, hoursAdvanced: number): void {
    if (hoursAdvanced >= 6 && Math.random() < 0.35) {
        const idx = Math.floor(Math.random() * WEATHER_CYCLE.length);
        clock.weather = WEATHER_CYCLE[idx] ?? 'clear';
    }
}

export function advanceGameClock(clock: PenaiGameClock, hours: number): PenaiGameClock {
    const safeHours = Math.max(0, hours);
    if (!safeHours) return { ...clock };

    let totalHours = clock.hour + safeHours;
    let day = clock.day;
    while (totalHours >= 24) {
        totalHours -= 24;
        day += 1;
    }

    const next: PenaiGameClock = {
        day,
        hour: totalHours,
        weather: clock.weather,
    };
    maybeRotateWeather(next, safeHours);
    return next;
}

export async function loadSessionGameClock(sessionId: number): Promise<PenaiGameClock> {
    const row = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    return parseGameClock(row?.gameClock as Record<string, unknown> | null);
}

export async function saveSessionGameClock(
    sessionId: number,
    clock: PenaiGameClock,
): Promise<PenaiGameClock> {
    const repo = PenaiDataSource.getRepository(GameSession);
    const row = await repo.findOne({ where: { id: sessionId } });
    if (!row) return clock;
    row.gameClock = clock as unknown as Record<string, unknown>;
    await repo.save(row);
    return clock;
}

export async function advanceSessionGameClock(
    sessionId: number,
    hours: number,
): Promise<PenaiGameClock> {
    const current = await loadSessionGameClock(sessionId);
    const next = advanceGameClock(current, hours);
    return saveSessionGameClock(sessionId, next);
}
