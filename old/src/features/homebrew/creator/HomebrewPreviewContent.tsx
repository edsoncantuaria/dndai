'use client';

import ExampleViewer from '@/components/Homebrew/ExampleViewer';
import { cn } from '@/lib/utils';
import type * as HomebrewService from '@/services/homebrewService';

export interface HomebrewPreviewContentProps {
  type: HomebrewService.HomebrewContentType;
  contentData: Record<string, unknown>;
  className?: string;
}

/** Renderiza raça/classe/magia etc. com o mesmo visualizador dos exemplos. */
export function HomebrewPreviewContent({ type, contentData, className }: HomebrewPreviewContentProps) {
  const hasName = typeof contentData.name === 'string' && contentData.name.trim().length > 0;
  const hasStructure = Object.entries(contentData || {}).some(([key, value]) => {
    if (['index', 'official_index', 'name', 'dependencies'].includes(key)) return false;
    if (value === undefined || value === null || value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0) {
      return false;
    }
    return true;
  });

  if (!hasName && !hasStructure) {
    return (
      <p className="font-narrative text-sm italic text-dnd-parchment-muted">
        Preencha os campos da estrutura para ver descrição, bônus e traços aqui.
      </p>
    );
  }

  return (
    <div
      className={cn(
        'homebrew-preview -mx-1 max-h-[min(55vh,420px)] overflow-y-auto overflow-x-hidden px-1',
        className
      )}
    >
      <ExampleViewer contentType={type} data={contentData} hideTitle />
    </div>
  );
}
