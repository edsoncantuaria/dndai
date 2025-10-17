import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Initialize genkit without a hardcoded API key.
// The key will be passed dynamically where needed.
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
