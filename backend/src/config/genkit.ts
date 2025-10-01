// backend/src/config/genkit.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// This is the central AI instance for the backend.
export const ai = genkit({
  plugins: [googleAI()],
});
