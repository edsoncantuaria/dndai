import { penaiEnv } from '../../config/penaiEnv.js';

export const DEFAULT_LOCALE = 'pt-BR' as const;

export function ensureDefaultLocale(): void {
    if (penaiEnv.DEFAULT_LOCALE !== DEFAULT_LOCALE) {
        console.warn(
            `[PENAI] Locale ${penaiEnv.DEFAULT_LOCALE} não suportado em v1; usando ${DEFAULT_LOCALE}.`,
        );
    }
}

export const PT_BR_SYSTEM_PREFIX =
    'Você é o Mestre de uma campanha de D&D 5e. Responda SOMENTE em português brasileiro. Não altere HP, inventário ou combate — apenas narre.';
