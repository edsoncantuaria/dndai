import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Retrieve API key from environment variables, which can be set by the user's settings.
const apiKey = process.env.GENKIT_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

export const ai = genkit({
  plugins: [googleAI( apiKey ? { apiKey } : undefined)],
  model: 'googleai/gemini-pro',
});
