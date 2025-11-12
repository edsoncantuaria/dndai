// backend/src/controllers/srdController.ts
import type { Request, Response } from 'express';
import { listSrdResources, getSrdResource } from '../services/srdCatalogService.js';
import {
    getNormalizedConditions,
    listNormalizedClasses,
    getNormalizedClass,
    listNormalizedArmors,
    getNormalizedArmor,
    listNormalizedSkills,
    listNormalizedSpells,
    getNormalizedSpell,
    getRestRules,
} from '../rules/index.js';

const NORMALIZED_RESOURCES = new Set(['conditions', 'classes', 'armors', 'skills', 'spells', 'rest']);

export const listResources = async (req: Request, res: Response) => {
    const { resource } = req.params;
    if (!resource) {
        res.status(400).json({ message: 'Resource parameter is required.' });
        return;
    }

    if (!NORMALIZED_RESOURCES.has(resource)) {
        const data = await listSrdResources(resource as any);
        res.json({ resource, count: data.length, results: data });
        return;
    }

    if (resource === 'conditions') {
        const conditions = await getNormalizedConditions();
        res.json({ resource, count: conditions.length, results: conditions });
        return;
    }

    if (resource === 'classes') {
        const classes = await listNormalizedClasses();
        res.json({ resource, count: classes.length, results: classes });
        return;
    }

    if (resource === 'armors') {
        const armors = await listNormalizedArmors();
        res.json({ resource, count: armors.length, results: armors });
        return;
    }

    if (resource === 'skills') {
        const skills = await listNormalizedSkills();
        res.json({ resource, count: skills.length, results: skills });
        return;
    }

    if (resource === 'spells') {
        const spells = await listNormalizedSpells();
        res.json({ resource, count: spells.length, results: spells });
        return;
    }

    if (resource === 'rest') {
        res.json({
            resource,
            count: 2,
            results: [
                { type: 'short', rules: getRestRules('short') },
                { type: 'long', rules: getRestRules('long') },
            ],
        });
        return;
    }
};

export const getResource = async (req: Request, res: Response) => {
    const { resource, index } = req.params;
    if (!resource || !index) {
        res.status(400).json({ message: 'Resource and index parameters are required.' });
        return;
    }

    if (resource === 'conditions') {
        const conditions = await getNormalizedConditions();
        const condition = conditions.find(cond => cond.index === index);
        if (!condition) {
            res.status(404).json({ message: 'Condition not found.' });
            return;
        }
        res.json(condition);
        return;
    }

    if (resource === 'classes') {
        const entry = await getNormalizedClass(index);
        if (!entry) {
            res.status(404).json({ message: 'Class not found.' });
            return;
        }
        res.json(entry);
        return;
    }

    if (resource === 'armors') {
        const armor = await getNormalizedArmor(index);
        if (!armor) {
            res.status(404).json({ message: 'Armor not found.' });
            return;
        }
        res.json(armor);
        return;
    }

    if (resource === 'skills') {
        const skills = await listNormalizedSkills();
        const skill = skills.find(s => s.index === index);
        if (!skill) {
            res.status(404).json({ message: 'Skill not found.' });
            return;
        }
        res.json(skill);
        return;
    }

    if (resource === 'spells') {
        const spell = await getNormalizedSpell(index);
        if (!spell) {
            res.status(404).json({ message: 'Spell not found.' });
            return;
        }
        res.json(spell);
        return;
    }

    if (resource === 'rest') {
        if (index !== 'short' && index !== 'long') {
            res.status(400).json({ message: 'Use indexes "short" ou "long".' });
            return;
        }
        res.json(getRestRules(index));
        return;
    }

    const result = await getSrdResource(resource as any, index);
    if (!result) {
        res.status(404).json({ message: 'Resource not found.' });
        return;
    }
    res.json(result);
};
