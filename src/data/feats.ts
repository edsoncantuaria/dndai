// data/feats.ts
import type { Feat } from '../types';

// This file is an example of how to add custom, "hard-coded" content
// that follows the same structure as the D&D 5e API.
// To add more feats, or other content like races or classes, you can
// create new files (e.g., customRaces.ts) and import them into dndApiService.ts

export const customFeats: Feat[] = [
    {
        "index": "grappler",
        "name": "Grappler",
        "prerequisites": [
            {
                "ability_score": {
                    "index": "str",
                    "name": "STR",
                    "url": "/api/ability-scores/str"
                },
                "minimum_score": 13
            }
        ],
        "desc": [
            "You’ve developed the skills necessary to hold your own in close-quarters grappling. You gain the following benefits:",
            "- You have advantage on attack rolls against a creature you are grappling.",
            "- You can use your action to try to pin a creature grappled by you. To do so, make another grapple check. If you succeed, you and the creature are both restrained until the grapple ends."
        ],
        "url": "/api/feats/grappler"
    }
];
