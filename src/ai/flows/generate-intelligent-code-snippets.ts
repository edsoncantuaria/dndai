'use server';

/**
 * @fileOverview Generates intelligent code snippets based on component arrangement, adding or skipping attributes and methods.
 *
 * - generateIntelligentCodeSnippet - A function that generates intelligent code snippets.
 * - GenerateIntelligentCodeSnippetInput - The input type for the generateIntelligentCodeSnippet function.
 * - GenerateIntelligentCodeSnippetOutput - The return type for the generateIntelligentCodeSnippet function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateIntelligentCodeSnippetInputSchema = z.object({
  componentArrangementDescription: z
    .string()
    .describe('Description of the arrangement of components on the canvas.'),
  pastedCode: z.string().describe('The code pasted by the user.'),
});

export type GenerateIntelligentCodeSnippetInput =
  z.infer<typeof GenerateIntelligentCodeSnippetInputSchema>;

const GenerateIntelligentCodeSnippetOutputSchema = z.object({
  generatedCodeSnippet: z.string().describe('The intelligently generated code snippet.'),
});

export type GenerateIntelligentCodeSnippetOutput =
  z.infer<typeof GenerateIntelligentCodeSnippetOutputSchema>;

export async function generateIntelligentCodeSnippet(
  input: GenerateIntelligentCodeSnippetInput
): Promise<GenerateIntelligentCodeSnippetOutput> {
  return generateIntelligentCodeSnippetFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateIntelligentCodeSnippetPrompt',
  input: {
    schema: GenerateIntelligentCodeSnippetInputSchema,
  },
  output: {
    schema: GenerateIntelligentCodeSnippetOutputSchema,
  },
  prompt: `You are an AI code generator that intelligently creates code snippets based on a description of component arrangements and existing code.

You will analyze the component arrangement description and the pasted code, automatically adding or skipping attributes and methods from the pasted code, depending on what is most common and relevant to the described arrangement.

Component Arrangement Description: {{{componentArrangementDescription}}}

Pasted Code: {{{pastedCode}}}

Generated Code Snippet:`, // Ask for the generated code snippet
});

const generateIntelligentCodeSnippetFlow = ai.defineFlow(
  {
    name: 'generateIntelligentCodeSnippetFlow',
    inputSchema: GenerateIntelligentCodeSnippetInputSchema,
    outputSchema: GenerateIntelligentCodeSnippetOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
