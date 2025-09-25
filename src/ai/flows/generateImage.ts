'use server';
/**
 * @fileOverview A flow for generating an image from a text prompt using a dynamic model.
 *
 * - generateImage - A function that takes a prompt, model, and optional API key to return a data URI.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateImageInputSchema = z.object({
  prompt: z.string().describe('A detailed text prompt for image generation.'),
  model: z.string().describe('The specific image generation model to use.'),
  apiKey: z.string().optional().describe('The API key for Google AI.'),
});

const GenerateImageOutputSchema = z.object({
  imageUrl: z.string().describe('The generated image as a data URI.'),
});

export async function generateImage(prompt: string, model: string, apiKey?: string): Promise<{ imageUrl: string } | null> {
    try {
        const result = await generateImageFlow({ prompt, model, apiKey });
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
    async ({ prompt, model, apiKey }) => {
        const { media } = await ai.generate({
            model: `googleai/${model}`,
            prompt: prompt,
            apiKey: apiKey, 
        });
        
        // Correctly access the URL from the media array
        if (!media || !Array.isArray(media) || media.length === 0 || !media[0].url) {
            throw new Error('Image generation failed to return a valid media object.');
        }

        return { imageUrl: media[0].url };
    }
);
