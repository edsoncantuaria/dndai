'use server';
/**
 * @fileOverview A flow for converting text to speech using Google's Gemini TTS model.
 *
 * - textToSpeech - A function that handles the text-to-speech conversion.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import wav from 'wav';
import { googleAI } from '@genkit-ai/googleai';

async function toWav(pcmData: Buffer, channels = 1, rate = 24000, sampleWidth = 2): Promise<string> {
    return new Promise((resolve, reject) => {
        const writer = new wav.Writer({
            channels,
            sampleRate: rate,
            bitDepth: sampleWidth * 8,
        });

        let bufs: any[] = [];
        writer.on('error', reject);
        writer.on('data', function (d) {
            bufs.push(d);
        });
        writer.on('end', function () {
            resolve(Buffer.concat(bufs).toString('base64'));
        });

        writer.write(pcmData);
        writer.end();
    });
}

const flowInputSchema = z.object({
  text: z.string(),
  model: z.string(),
  apiKey: z.string().optional(),
});

const textToSpeechFlow = ai.defineFlow(
    {
        name: 'textToSpeechFlow',
        inputSchema: flowInputSchema,
        outputSchema: z.object({ media: z.string() }),
    },
    async ({text, model, apiKey}) => {
        const customAI = apiKey ? genkit({ plugins: [googleAI({ apiKey })] }) : ai;

        const { media } = await customAI.generate({
            model: `googleai/${model}`,
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Algenib' }, // A standard, clear voice
                    },
                },
            },
            prompt: text,
        });

        if (!media) {
            throw new Error('No media returned from TTS model');
        }

        const audioBuffer = Buffer.from(
            media.url.substring(media.url.indexOf(',') + 1),
            'base64'
        );

        const wavBase64 = await toWav(audioBuffer);

        return {
            media: 'data:audio/wav;base64,' + wavBase64,
        };
    }
);

export async function textToSpeech(text: string, model: string, apiKey?: string): Promise<{ media: string } | null> {
    try {
        return await textToSpeechFlow({text, model, apiKey});
    } catch (error) {
        console.error("Error in textToSpeech flow:", error);
        return null;
    }
}
