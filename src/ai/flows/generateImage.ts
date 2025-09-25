'use server';
/**
 * @fileOverview A flow for generating an image from a text prompt using Imagen.
 *
 * - generateImage - A function that takes a prompt and returns a data URI for the generated image.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/googleai';

const GenerateImageInputSchema = z.object({
  prompt: z.string().describe('A detailed text prompt for image generation.'),
  apiKey: z.string().optional().describe('The API key for Google AI.'),
});

const GenerateImageOutputSchema = z.object({
  imageUrl: z.string().describe('The generated image as a data URI.'),
});

export async function generateImage(prompt: string, apiKey?: string): Promise<{ imageUrl: string } | null> {
    try {
        const result = await generateImageFlow({ prompt, apiKey });
        return result;
    } catch (error) {
        console.error('Error in generateImage flow:', error);
        return null;
    }
}

const generateImageFlow = ai.defineFlow(
    {
        name: 'generateImageFlow',
        inputSchema: GenerateImageInputSchema,
        outputSchema: GenerateImageOutputSchema,
    },
    async ({ prompt, apiKey }) => {
        const customAI = apiKey ? genkit({ plugins: [googleAI({ apiKey })] }) : ai;

        const { media } = await customAI.generate({
            model: 'googleai/imagen-4.0-fast-generate-001',
            prompt: prompt,
        });

        if (!media.url) {
            throw new Error('Image generation failed to return a URL.');
        }

        return { imageUrl: media.url };
    }
);
