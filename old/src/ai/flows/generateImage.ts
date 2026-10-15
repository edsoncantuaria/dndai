'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateImageInputSchema = z.object({
  prompt: z.string().describe('A detailed text prompt for image generation.'),
  model: z.string().describe('The specific image generation model to use, ex: "imagen-4.0-fast-generate-001"'),
  apiKey: z.string().optional().describe('The API key for Google AI.'),
});

const GenerateImageOutputSchema = z.object({
  imageUrl: z.string().describe('The generated image URL in data URI format.'),
});

export async function generateImage(input: z.infer<typeof GenerateImageInputSchema>): Promise<{ imageUrl: string } | null> {
  try {
    const result = await generateImageFlow(input);
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
    
    // Determine the correct parameters based on the model type
    const isMultimodalImageModel = model.includes('image-preview');
    const isImagenModel = model.startsWith('imagen');

    const response = await ai.generate({
      model: `googleai/${model}`,
      prompt: prompt,
      apiKey: apiKey,
      // Add model-specific configuration based on its type
      ...(isMultimodalImageModel ? {
        config: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      } : {}),
      ...(isImagenModel ? {
        output: { format: 'media' },
      } : {}),
    });
    
    // Genkit v1.x provides media in `response.media` for both model types when configured correctly
    const imageUrl = response.media?.url;

    if (imageUrl) {
      return { imageUrl };
    }

    throw new Error('A geração de imagem falhou ou retornou um resultado vazio.');
  }
);
