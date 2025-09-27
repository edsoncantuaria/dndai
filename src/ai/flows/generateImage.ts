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
    
    // Modelos 'imagen' são para text-to-image direto.
    // Modelos 'gemini-*-image-preview' são multimodais.
    const isMultimodalImageModel = model.includes('image-preview');

    const response = await ai.generate({
      model: `googleai/${model}`,
      prompt: prompt,
      apiKey: apiKey,
      ...(isMultimodalImageModel ? {
        config: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      } : {
        output: {
          format: 'media'
        }
      }),
    });
    
    // A resposta de mídia em Genkit v1.x vem na propriedade `output.media`.
    const imageUrl = response.output?.media?.url;

    if (imageUrl) {
      return { imageUrl };
    }

    throw new Error('A geração de imagem falhou ou retornou um resultado vazio.');
  }
);
