'use client';

import { useActionState, useEffect, useRef } from 'react';
import { generateCodeAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import type { CanvasComponent } from '@/lib/types';
import { Copy, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from './ui/separator';

const initialState = {
  message: '',
  codeSnippet: null,
  error: null,
};

export function CodeGenerator({ components }: { components: CanvasComponent[] }) {
  const [state, formAction, isPending] = useActionState(generateCodeAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (state.error) {
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: state.error,
      });
    }
  }, [state.error, toast]);

  const handleCopy = () => {
    if (state.codeSnippet) {
      navigator.clipboard.writeText(state.codeSnippet);
      toast({
        title: 'Copied to clipboard!',
        description: 'The code snippet has been copied to your clipboard.',
      });
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4 px-2">Generate Code</h2>
      <form ref={formRef} action={formAction}>
        <div className="space-y-4 px-2">
          <input type="hidden" name="canvasState" value={JSON.stringify(components)} />
          <div className="space-y-2">
            <Label htmlFor="pastedCode">Paste Component Code</Label>
            <Textarea
              id="pastedCode"
              name="pastedCode"
              placeholder="Paste your React component code here..."
              className="h-32 min-h-32 font-code text-xs"
            />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? (
              'Generating...'
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Snippet
              </>
            )}
          </Button>
        </div>
        {state.codeSnippet && (
            <div className="space-y-2 mt-6 px-2">
                <Separator />
                <div className="pt-4">
                    <Label>Generated Snippet</Label>
                    <div className="relative mt-2">
                        <pre className="bg-muted rounded-md p-4 text-xs font-code overflow-x-auto">
                        <code>{state.codeSnippet}</code>
                        </pre>
                        <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="absolute top-2 right-2 h-7 w-7"
                        onClick={handleCopy}
                        aria-label="Copy code"
                        >
                        <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        )}
      </form>
    </div>
  );
}
