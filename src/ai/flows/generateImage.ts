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
    const response = await ai.generate({
      model: `googleai/${model}`,  
      prompt: prompt,
      apiKey: apiKey,
      // **Adicionado** a configuração para especificar modalidades de resposta
      config: {
        responseModalities: ["TEXT", "IMAGE"],  // necessário para Gemini/Nano Banana gerar imagens
      },
    });

    // acessar a parte de imagem no retorno multimodal
    const imagePart = response.media?.[0];  // geralmente é um array
    if (imagePart && imagePart.url) {
      return { imageUrl: imagePart.url };
    }

    throw new Error('Image generation failed to return a valid media object.');
  }
);
