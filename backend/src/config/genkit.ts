// backend/src/config/genkit.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Esta é a instância central de IA para o backend.
export const ai = genkit({
  plugins: [googleAI()],
});
