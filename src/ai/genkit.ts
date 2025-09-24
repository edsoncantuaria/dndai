import './dev';
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Retrieve API key from environment variables.
const apiKey = process.env.GENKIT_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

export const ai = genkit({
  plugins: [googleAI( apiKey ? { apiKey } : undefined)],
  model: 'googleai/gemini-pro',
});
