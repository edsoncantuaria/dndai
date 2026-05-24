const STORAGE_KEY = 'dndai_gemini_api_key';
const LEGACY_SETTINGS_KEY = 'userSettings';

/** Lê a chave Gemini salva no navegador (não vai ao servidor). */
export function readGeminiApiKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function writeGeminiApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = key.trim();
  try {
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    console.warn('Não foi possível salvar a chave de API no localStorage.');
  }
}

/** Migra chave antiga embutida em `userSettings`. */
export function migrateGeminiApiKeyFromLegacySettings(): string {
  if (typeof window === 'undefined') return '';
  const existing = readGeminiApiKey();
  if (existing) return existing;

  try {
    const raw = localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (!raw) return '';
    const settings = JSON.parse(raw) as { apiKey?: string };
    const legacy = settings.apiKey?.trim();
    if (legacy) {
      writeGeminiApiKey(legacy);
      return legacy;
    }
  } catch {
    /* ignore */
  }
  return '';
}
