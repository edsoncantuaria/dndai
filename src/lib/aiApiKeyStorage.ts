const STORAGE_KEY = 'dndai_openrouter_api_key';
const LEGACY_GEMINI_KEY = 'dndai_gemini_api_key';
const LEGACY_SETTINGS_KEY = 'userSettings';

/** Chave OpenRouter (gameplay). Permanece no dispositivo — não vai ao servidor. */
export function readAiApiKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    const current = localStorage.getItem(STORAGE_KEY)?.trim();
    if (current) return current;
    const legacyGemini = localStorage.getItem(LEGACY_GEMINI_KEY)?.trim();
    return legacyGemini ?? '';
  } catch {
    return '';
  }
}

export function writeAiApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = key.trim();
  try {
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_GEMINI_KEY);
    }
  } catch {
    console.warn('Não foi possível salvar a chave de API no localStorage.');
  }
}

export function migrateAiApiKeyFromLegacySettings(): string {
  if (typeof window === 'undefined') return '';
  const existing = readAiApiKey();
  if (existing) return existing;

  try {
    const raw = localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (!raw) return '';
    const settings = JSON.parse(raw) as { apiKey?: string };
    const legacy = settings.apiKey?.trim();
    if (legacy) {
      writeAiApiKey(legacy);
      return legacy;
    }
  } catch {
    /* ignore */
  }
  return '';
}

/** @deprecated use readAiApiKey */
export const readGeminiApiKey = readAiApiKey;
/** @deprecated use writeAiApiKey */
export const writeGeminiApiKey = writeAiApiKey;
/** @deprecated use migrateAiApiKeyFromLegacySettings */
export const migrateGeminiApiKeyFromLegacySettings = migrateAiApiKeyFromLegacySettings;
