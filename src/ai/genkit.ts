import { genkit, configureGenkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { textToSpeech } from './flows/textToSpeech';

configureGenkit({
  plugins: [
    googleAI({
      apiVersion: 'v1beta',
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});

export { textToSpeech };
