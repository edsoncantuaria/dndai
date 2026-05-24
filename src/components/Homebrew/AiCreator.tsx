'use client';

import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand } from 'lucide-react';
import ActionModal from '../ui/ActionModal';
import { createHomebrewContent } from '@/ai/flows/createHomebrewFlow';
import * as HomebrewService from '@/services/homebrewService';
import { useSettingsContext } from '@/contexts/SettingsContext';
import SrdSourcePanel from './SrdSourcePanel';

const CONTENT_TYPES: HomebrewService.HomebrewContentType[] = [
  'race', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat',
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
}

const AiCreator: React.FC<Props> = ({ isOpen, onClose, onContentGenerated }) => {
  const [prompt, setPrompt] = useState('');
  const [type, setType] = useState<HomebrewService.HomebrewContentType>('item');
  const [sourceKind, setSourceKind] = useState<HomebrewService.HomebrewSourceKind>('original');
  const [sourceResource, setSourceResource] = useState<string | null>(null);
  const [sourceIndex, setSourceIndex] = useState<string | null>(null);
  const [srdBase, setSrdBase] = useState<Record<string, unknown> | null>(null);
  const [locale, setLocale] = useState('pt-BR');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { getApiKey } = useSettingsContext();

  const resetSrd = () => {
    setSourceResource(null);
    setSourceIndex(null);
    setSrdBase(null);
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
      toast({ variant: 'destructive', title: 'Base SRD necessária', description: 'Selecione um recurso oficial para tradução ou fork.' });
      return;
    }

    setIsLoading(true);
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        throw new Error('Chave de API não encontrada.');
      }
      const result = await createHomebrewContent({
        prompt,
        type: type as 'race' | 'class' | 'subclass' | 'spell' | 'item' | 'monster' | 'background' | 'feat',
        apiKey,
        sourceKind,
        sourceResource,
        sourceIndex,
        srdBase,
        locale,
      });
      if (result?.content) {
        onContentGenerated({
          content: result.content,
          type,
          sourceKind,
          sourceResource,
          sourceIndex,
          locale,
        });
        toast({ title: 'Conteúdo gerado', description: 'Revise no editor antes de salvar.' });
        onClose();
      } else {
        throw new Error('A IA não conseguiu gerar o conteúdo.');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Falha na geração', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ActionModal
      isOpen={isOpen}
      title="Gerar conteúdo com IA"
      onClose={onClose}
      actions={[
        { text: 'Cancelar', onClick: onClose, variant: 'secondary' },
        {
          text: 'Gerar',
          onClick: handleSubmit,
          variant: 'primary',
          disabled: isLoading,
          icon: isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand className="h-4 w-4" />,
        },
      ]}
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
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

        {sourceKind !== 'original' && (
          <SrdSourcePanel
            homebrewType={type}
            sourceKind={sourceKind === 'fork' ? 'fork' : 'translation'}
            selectedIndex={sourceIndex}
            onOfficialLoaded={handleOfficialLoaded}
          />
        )}

        <div>
          <label htmlFor="ai-locale" className="block text-sm font-medium text-stone-300 mb-1">
            Locale
          </label>
          <input
            id="ai-locale"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200"
          />
        </div>

        <div>
          <label htmlFor="ai-prompt" className="block text-sm font-medium text-stone-300 mb-1">
            Sua ideia
          </label>
          <textarea
            id="ai-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder={
              sourceKind === 'translation'
                ? 'Ex: Traduza mantendo tom épico e termos de D&D em português.'
                : sourceKind === 'fork'
                  ? 'Ex: Versão mais forte que causa +1d6 de dano de fogo e exige componente de rubi.'
                  : 'Ex: Uma espada longa que causa 1d6 de dano de fogo extra.'
            }
            className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500"
          />
        </div>

        <p className="text-xs text-stone-500 italic">
          A IA gera JSON compatível com a 5e-srd-api. Em tradução/fork, o schema oficial é usado como base.
        </p>
      </div>
    </ActionModal>
  );
};

export default AiCreator;
