import { OSS_NARRATIVE_QUALITY_BLOCK } from '../narrativeQuality.js';

export const OSS_MINIMAL_SCHEMA_REF =
    'JSON APENAS: {"narration":"string","tone":"dark|tense|hopeful|neutral|epic"?,"newFacts"?[{"fact":"...","importance":"low|medium|high"}],"systemLog"?}';

export const OSS_MINIMAL_FORMAT_SYSTEM = `Você é o Mestre de um RPG D&D 5e. Português (Brasil).
Responda APENAS com um objeto JSON válido, sem markdown.
${OSS_MINIMAL_SCHEMA_REF}
NÃO inclua actionOptions, logEntries, HP, combate, inventário ou rolagens — o servidor gera opções.
Proibido: inventar mecânicas; só narre o desfecho visível.
${OSS_NARRATIVE_QUALITY_BLOCK}`;
