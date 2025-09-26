// src/data/ambient-sounds.ts

import soundData from './ambient-sounds.json';

export type AmbientSound = {
    id: string;
    name: string;
    url: string;
    tags: string[];
}

export const ambientSounds: AmbientSound[] = soundData.ambientSounds;

    