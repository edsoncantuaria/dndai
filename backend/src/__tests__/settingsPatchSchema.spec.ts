import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SettingsPatchSchema, SettingsSchema } from '../schemas/validationSchemas.js';

describe('SettingsPatchSchema', () => {
    it('aceita PATCH só com apiKey BYOK', () => {
        const parsed = SettingsPatchSchema.parse({
            apiKey: 'AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxx',
        });
        assert.equal(parsed.apiKey, 'AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxx');
    });

    it('SettingsSchema completo ainda exige campos obrigatórios', () => {
        const result = SettingsSchema.safeParse({ apiKey: 'AIzaSyDtest' });
        assert.equal(result.success, false);
    });
});
