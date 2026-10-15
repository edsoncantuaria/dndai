'use client';

import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand } from 'lucide-react';
import ActionModal from '../ui/ActionModal';
import { createHomebrewContent } from '@/ai/flows/createHomebrewFlow';
import * as HomebrewService from '@/services/homebrewService';
import { useSettingsContext } from '@/contexts/SettingsContext';
import SrdSourcePanel from './SrdSourcePanel';
import { DndButton, DndCard, DndHeading, DndSheet, DndTextarea } from '@/components/primitives';
import { creatorSelectClass } from '@/features/homebrew/creator/constants';

const CONTENT_TYPES: HomebrewService.HomebrewContentType[] = [
  'race',
  'class',
  'subclass',
  'spell',
  'item',
  'monster',
  'background',
  'feat',
];

export interface AiGeneratedHomebrew {
  content: Record<string, unknown>;
  type: HomebrewService.HomebrewContentType;
  sourceKind?: HomebrewService.HomebrewSourceKind;
  sourceResource?: string | null;
  sourceIndex?: string | null;
  locale?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onContentGenerated: (payload: AiGeneratedHomebrew) => void;
  variant?: 'legacy' | 'v2';
}

const AiCreator: React.FC<Props> = ({ isOpen, onClose, onContentGenerated, variant = 'legacy' }) => {
  const isV2 = variant === 'v2';
  const [prompt, setPrompt] = useState('');
  const [type, setType] = useState<HomebrewService.HomebrewContentType>('item');
  const [sourceKind, setSourceKind] = useState<HomebrewService.HomebrewSourceKind>('original');
  const [sourceResource, setSourceResource] = useState<string | null>(null);
  const [sourceIndex, setSourceIndex] = useState<string | null>(null);
  const [srdBase, setSrdBase] = useState<Record<string, unknown> | null>(null);
  const [locale, setLocale] = useState('pt-BR');
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<AiGeneratedHomebrew | null>(null);
  const { toast } = useToast();
  const { getApiKey } = useSettingsContext();

  const resetSrd = () => {
    setSourceResource(null);
    setSourceIndex(null);
    setSrdBase(null);
  };

  const resetAll = () => {
    setPrompt('');
    setPreview(null);
    resetSrd();
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const handleOfficialLoaded = ({
    sourceResource: resource,
    sourceIndex: index,
    official,
  }: {
    sourceResource: string;
    sourceIndex: string;
    official: Record<string, unknown>;
  }) => {
    setSourceResource(resource);
    setSourceIndex(index);
    setSrdBase(official);
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      toast({ variant: 'destructive', title: 'Prompt obrigatório', description: 'Descreva o que você quer criar.' });
      return;
    }
    if (sourceKind !== 'original' && !srdBase) {
      toast({
        variant: 'destructive',
        title: 'Base SRD necessária',
        description: 'Selecione um recurso oficial para tradução ou fork.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await createHomebrewContent({
        prompt,
        type: type as 'race' | 'class' | 'subclass' | 'spell' | 'item' | 'monster' | 'background' | 'feat',
        apiKey: getApiKey() ?? '',
        sourceKind,
        sourceResource,
        sourceIndex,
        srdBase,
        locale,
      });
      if (result?.content) {
        const payload: AiGeneratedHomebrew = {
          content: result.content,
          type,
          sourceKind,
          sourceResource,
          sourceIndex,
          locale,
        };
        if (isV2) {
          setPreview(payload);
          toast({ title: 'Rascunho pronto', description: 'Revise o pergaminho antes de abrir o editor.' });
        } else {
          onContentGenerated(payload);
          toast({ title: 'Conteúdo gerado', description: 'Revise no editor antes de salvar.' });
          handleClose();
        }
      } else {
        throw new Error('A IA não conseguiu gerar o conteúdo.');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Falha na geração', description: message });
    } finally {
      setIsLoading(false);
    }
  };

  const applyPreview = () => {
    if (!preview) return;
    onContentGenerated(preview);
    handleClose();
  };

  const formBody = (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      {!isV2 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="ai-source-kind" className="block text-sm font-medium text-stone-300 mb-1">
              Modo
            </label>
            <select
              id="ai-source-kind"
              value={sourceKind}
              onChange={(e) => {
                setSourceKind(e.target.value as HomebrewService.HomebrewSourceKind);
                resetSrd();
              }}
              className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200"
            >
              <option value="original">Original (schema SRD)</option>
              <option value="translation">Tradução de SRD</option>
              <option value="fork">Fork de SRD</option>
            </select>
          </div>
          <div>
            <label htmlFor="content-type" className="block text-sm font-medium text-stone-300 mb-1">
              Tipo de conteúdo
            </label>
            <select
              id="content-type"
              value={type}
              onChange={(e) => {
                setType(e.target.value as HomebrewService.HomebrewContentType);
                resetSrd();
              }}
              className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200"
            >
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-ui text-xs uppercase tracking-wider text-dnd-parchment-muted">
              Modo
            </label>
            <select
              value={sourceKind}
              onChange={(e) => {
                setSourceKind(e.target.value as HomebrewService.HomebrewSourceKind);
                resetSrd();
                setPreview(null);
              }}
              className={creatorSelectClass}
            >
              <option value="original">Original</option>
              <option value="translation">Tradução SRD</option>
              <option value="fork">Fork SRD</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block font-ui text-xs uppercase tracking-wider text-dnd-parchment-muted">
              Tipo
            </label>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as HomebrewService.HomebrewContentType);
                resetSrd();
                setPreview(null);
              }}
              className={creatorSelectClass}
            >
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {sourceKind !== 'original' && (
        <SrdSourcePanel
          variant={variant}
          homebrewType={type}
          sourceKind={sourceKind === 'fork' ? 'fork' : 'translation'}
          selectedIndex={sourceIndex}
          onOfficialLoaded={handleOfficialLoaded}
        />
      )}

      <div>
        {isV2 ? (
          <label className="mb-1 block font-ui text-xs uppercase tracking-wider text-dnd-parchment-muted">
            Locale
          </label>
        ) : (
          <label htmlFor="ai-locale" className="block text-sm font-medium text-stone-300 mb-1">
            Locale
          </label>
        )}
        <input
          id="ai-locale"
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
          className={isV2 ? creatorSelectClass : 'w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200'}
        />
      </div>

      <div>
        {isV2 ? (
          <DndTextarea
            label="Descreva sua ideia"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            placeholder={
              sourceKind === 'translation'
                ? 'Ex: Traduza mantendo tom épico e termos de D&D em português.'
                : sourceKind === 'fork'
                  ? 'Ex: Versão mais forte com +1d6 de fogo e componente de rubi.'
                  : 'Ex: Uma espada longa que causa 1d6 de dano de fogo extra.'
            }
          />
        ) : (
          <>
            <label htmlFor="ai-prompt" className="block text-sm font-medium text-stone-300 mb-1">
              Sua ideia
            </label>
            <textarea
              id="ai-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Ex: Uma espada longa que causa 1d6 de dano de fogo extra."
              className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500"
            />
          </>
        )}
      </div>

      {isV2 && preview ? (
        <DndCard
          padding="md"
          className="border-dnd-gold/25 bg-[linear-gradient(165deg,rgba(251,191,36,0.1),transparent_50%)]"
        >
          <DndHeading variant="label">Pergaminho gerado</DndHeading>
          <h3 className="mt-2 font-display text-lg text-dnd-parchment">
            {String(preview.content.name ?? 'Sem nome')}
          </h3>
          <p className="mt-1 font-ui text-xs capitalize text-dnd-parchment-muted">{preview.type}</p>
          <pre className="mt-3 max-h-40 overflow-auto rounded-md border border-dnd-gold/15 bg-dnd-obsidian p-3 font-mono text-[11px] text-dnd-parchment-muted">
            {JSON.stringify(preview.content, null, 2)}
          </pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <DndButton variant="ghost" size="sm" onClick={() => setPreview(null)}>
              Gerar de novo
            </DndButton>
            <DndButton variant="ember" size="sm" onClick={applyPreview}>
              Abrir no editor
            </DndButton>
          </div>
        </DndCard>
      ) : null}

      <p className={isV2 ? 'font-ui text-xs text-dnd-parchment-muted' : 'text-xs text-stone-500 italic'}>
        A IA gera JSON compatível com a 5e-srd-api. Em tradução/fork, o schema oficial é a base.
      </p>
    </div>
  );

  if (isV2) {
    return (
      <DndSheet open={isOpen} onOpenChange={(open) => !open && handleClose()} title="Forjar com IA">
        {formBody}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-dnd-gold/15 pt-4">
          <DndButton variant="ghost" onClick={handleClose}>
            Cancelar
          </DndButton>
          {!preview ? (
            <DndButton variant="ember" onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand className="h-4 w-4" />}
              Gerar pergaminho
            </DndButton>
          ) : null}
        </div>
      </DndSheet>
    );
  }

  return (
    <ActionModal
      isOpen={isOpen}
      title="Gerar conteúdo com IA"
      onClose={handleClose}
      actions={[
        { text: 'Cancelar', onClick: handleClose, variant: 'secondary' },
        {
          text: 'Gerar',
          onClick: handleSubmit,
          variant: 'primary',
          disabled: isLoading,
          icon: isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand className="h-4 w-4" />,
        },
      ]}
    >
      {formBody}
    </ActionModal>
  );
};

export default AiCreator;
