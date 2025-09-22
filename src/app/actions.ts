'use server';

import { generateIntelligentCodeSnippet } from '@/ai/flows/generate-intelligent-code-snippets';
import type { CanvasComponent } from '@/lib/types';

export async function generateCodeAction(
  prevState: any,
  formData: FormData
): Promise<{ message: string; codeSnippet: string | null; error: string | null }> {
  const pastedCode = formData.get('pastedCode') as string;
  const canvasState = formData.get('canvasState') as string;

  if (!pastedCode.trim() || !canvasState) {
    return { message: 'Missing data', codeSnippet: null, error: 'Pasted code is required.' };
  }

  try {
    const components: CanvasComponent[] = JSON.parse(canvasState);
    const componentArrangementDescription =
      components.length > 0
        ? components
            .map(
              (c) =>
                `${c.type} at (top: ${Math.round(c.props.style.top)}px, left: ${Math.round(
                  c.props.style.left
                )}px)`
            )
            .join(', ')
        : 'The canvas is empty.';

    const result = await generateIntelligentCodeSnippet({
      pastedCode,
      componentArrangementDescription,
    });

    return {
      message: 'Success',
      codeSnippet: result.generatedCodeSnippet,
      error: null,
    };
  } catch (e) {
    console.error(e);
    const error = e instanceof Error ? e.message : 'An unknown error occurred during generation.';
    return { message: 'Error', codeSnippet: null, error };
  }
}
