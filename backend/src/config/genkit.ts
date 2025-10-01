// backend/src/config/genkit.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// This is the central AI instance for the backend.
// Note: We don't configure a specific apiKey here because
// it will be provided dynamically for each user's request.
export const ai = genkit({
  plugins: [googleAI({ apiVersion: 'v1beta' })],
});
