'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, KeyRound } from 'lucide-react';
import ActionModal from '@/components/ui/ActionModal';
import { DndInput } from '@/components/primitives';
import { useAuth } from '@/contexts/AuthContext';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { aiKeyRequiredMessage } from '@/lib/clientAiAccess';

const GEMINI_STUDIO_URL = 'https://aistudio.google.com/apikey';

export interface AiKeyRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function AiKeyRequiredModal({ isOpen, onClose, onSaved }: AiKeyRequiredModalProps) {
  const { aiAccess, saveApiKey } = useAuth();
  const { apiKey, setApiKey } = useSettingsContext();
  const [draft, setDraft] = useState(apiKey);

  useEffect(() => {
    if (isOpen) setDraft(apiKey);
  }, [isOpen, apiKey]);

  const saveAndClose = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const ok = await saveApiKey(trimmed);
    if (!ok) return;
    setApiKey(trimmed);
    onSaved?.();
    onClose();
  };

  const openFullSettings = () => {
    onClose();
    window.dispatchEvent(new Event('game-open-settings'));
  };

  return (
    <ActionModal
      isOpen={isOpen}
      title="Chave Gemini necessária"
      onClose={onClose}
      actions={[
        { text: 'Depois', onClick: onClose, variant: 'secondary' },
        { text: 'Salvar e continuar', onClick: saveAndClose, variant: 'primary', disabled: !draft.trim() },
      ]}
    >
      <div className="space-y-4 font-ui text-dnd-parchment-muted">
        <p className="flex items-start gap-2 text-sm leading-relaxed text-dnd-parchment">
          <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-dnd-gold" />
          {aiKeyRequiredMessage(aiAccess)}
        </p>

        <DndInput
          label="Chave API (Google AI Studio)"
          id="ai-key-required-input"
          type="password"
          autoComplete="off"
          placeholder="AIza…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />

        <p className="text-xs">
          <a
            href={GEMINI_STUDIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-dnd-ember hover:underline"
          >
            Criar chave gratuita no AI Studio
            <ExternalLink className="h-3 w-3" />
          </a>
          {' · '}
          <button type="button" className="text-dnd-gold hover:underline" onClick={openFullSettings}>
            Abrir configurações completas
          </button>
        </p>
      </div>
    </ActionModal>
  );
}
