'use server';
/**
 * @fileOverview A flow for generating an image from a text prompt using Imagen.
 *
 * - generateImage - A function that takes a prompt and returns a data URI for the generated image.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateImageInputSchema = z.object({
  prompt: z.string().describe('A detailed text prompt for image generation.'),
});

const GenerateImageOutputSchema = z.object({
  imageUrl: z.string().describe('The generated image as a data URI.'),
});

export async function generateImage(prompt: string): Promise<{ imageUrl: string } | null> {
    try {
        const result = await generateImageFlow({ prompt });
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
    async ({ prompt }) => {
        const { media } = await ai.generate({
            model: 'googleai/imagen-4.0-fast-generate-001',
            prompt: prompt,
        });

        if (!media.url) {
            throw new Error('Image generation failed to return a URL.');
        }

        return { imageUrl: media.url };
    }
);
