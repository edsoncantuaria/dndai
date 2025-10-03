// backend/src/config/genkit.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { registerPlugin } from 'genkit/plugins';


// This is the central AI instance for the backend.
export const ai = genkit({
  plugins: [googleAI()],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
