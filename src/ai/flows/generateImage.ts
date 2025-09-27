'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateImageInputSchema = z.object({
  prompt: z.string().describe('A detailed text prompt for image generation.'),
  model: z.string().describe('The specific image generation model to use, ex: "gemini-2.5-flash-image-preview"'),
  apiKey: z.string().optional().describe('The API key for Google AI.'),
});

const GenerateImageOutputSchema = z.object({
  imageUrl: z.string().describe('The generated image URL.'),
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
    // Para modelos multimodais como o 'flash-image-preview', é necessário
    // especificar que tanto TEXTO quanto IMAGEM são modalidades de resposta esperadas.
    const isMultimodalImageModel = model.includes('image-preview');

    const response = await ai.generate({
      model: `googleai/${model}`,  
      prompt: prompt,
      apiKey: apiKey,
      ...(isMultimodalImageModel && {
        config: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      })
    });
    
    // A resposta de mídia em Genkit v1.x vem na propriedade `media`.
    const imagePart = response.media;
    if (imagePart?.url) {
      return { imageUrl: imagePart.url };
    }

    throw new Error('A geração de imagem falhou ou retornou um resultado vazio.');
  }
);
