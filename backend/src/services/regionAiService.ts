// backend/src/services/regionAiService.ts
import { GoogleGenAI } from '@google/genai';
import createError from 'http-errors';
import { env } from '../config/env.js';

const MODEL_ID = process.env.REGION_MODEL_ID || 'gemini-1.5-flash';

type RegionDraft = {
  region: {
    name: string;
    slug?: string;
    type: string;
    summary?: string;
    metadata?: Record<string, any>;
    parentSlug?: string | null;
  };
  links?: Array<{
    toSlug: string;
    travelMode?: string;
    travelTimeMinutes?: number;
    difficulty?: string;
    notes?: string;
  }>;
  pointsOfInterest?: Array<{
    name: string;
    slug?: string;
    type?: string;
    summary?: string;
    description?: string;
    metadata?: Record<string, any>;
  }>;
};

const REGION_SYSTEM_PROMPT = `
Você é um cartógrafo especialista em mundos de fantasia no estilo MMORPG (referência: Ragnarok Online).
Sua tarefa é gerar regiões e conexões coerentes em formato JSON. Siga as regras:
- Sem narrativa solta; responda APENAS com um JSON válido.
- Sempre proponha slug em minúsculas com hífens.
- Sempre inclua pelo menos um point_of_interest (POI) relevante por região criada.
- Use travelMode dentre: walk, mount, airship, portal, ship, teleport.
- Inclua tempos aproximados de viagem em minutos.
- No campo metadata, você pode sugerir clima predominante, nível recomendado, perigos, recompensas.

Estrutura esperada:
{
  "region": { "name": "...", "slug": "...", "type": "city|dungeon|wild|world|instance", "summary": "...", "metadata": {...}, "parentSlug": "midgard" },
  "links": [
    { "toSlug": "prontera", "travelMode": "airship", "travelTimeMinutes": 30, "difficulty": "baixa", "notes": "Linha comercial" }
  ],
  "pointsOfInterest": [
    { "name": "Salão das Runas", "slug": "salao-das-runas", "type": "dungeon", "summary": "...", "description": "...", "metadata": {...} }
  ]
}
`;

export const suggestRegionDraft = async (
  prompt: string,
  baseRegionSlug?: string,
  apiKey?: string
): Promise<RegionDraft> => {
  const key = apiKey || env.GEMINI_API_KEY;
  if (!key) throw createError(401, 'Chave de API para o Gemini não configurada.');

  const genAI = new GoogleGenAI({ apiKey: key });
  const augmentedPrompt = baseRegionSlug
    ? `${prompt}\nConsidere que esta nova região deve se conectar a: ${baseRegionSlug}.`
    : prompt;

  try {
    const result = await genAI.models.generateContent({
      model: MODEL_ID,
      contents: [
        {
          role: 'user',
          parts: [{ text: augmentedPrompt }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.4,
        systemInstruction: {
          role: 'system',
          parts: [{ text: REGION_SYSTEM_PROMPT }],
        },
      },
    });
    const raw = result.text ?? '';
    if (!raw.trim()) throw createError(500, 'A IA retornou uma resposta vazia.');
    const parsed = JSON.parse(raw);
    if (!parsed.region) throw createError(500, 'A IA não retornou o objeto "region".');
    return parsed;
  } catch (error: any) {
    console.error('[regionAiService] Falha ao chamar o Gemini:', error);
    throw createError(502, `Falha na comunicação com a IA: ${error.message}`);
  }
};
