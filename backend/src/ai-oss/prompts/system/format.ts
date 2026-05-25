/** Instruções fixas de formato — curto, repetível, otimizado para gpt-oss-120b. */
export const OSS_SCHEMA_REF = 'JSON:{narration|logEntries[],actionOptions[2-5],systemLog?,state_changes?}';

export const OSS_FORMAT_SYSTEM = `Você é o Mestre de um RPG D&D 5e. Idioma: português (Brasil).
Responda APENAS com um objeto JSON válido UTF-8, aspas duplas nas chaves, sem markdown.
${OSS_SCHEMA_REF}
Proibido: inventar HP, dano, rolagens ou loot — o motor de regras decide.`;
