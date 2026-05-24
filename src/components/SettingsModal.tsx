// src/components/SettingsModal.tsx
'use client';

import React, { ChangeEvent, useMemo, useState } from 'react';
import { useSettingsContext, AVAILABLE_MODELS, AVAILABLE_TTS_MODELS, GenerationConfig, AVAILABLE_TTS_VOICES, ThemePreset } from '../contexts/SettingsContext';
import { Info, KeyRound, Volume2, VolumeX, FlaskConical, RefreshCw, Eraser, Palette, Sparkles, Accessibility, Undo2, AudioWaveform, Loader2, Shield, Dice5, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { useNarrationSpeech } from '@/hooks/useNarrationSpeech';
import { apiClient } from '@/services/apiClient';
import { generateSceneImage as requestSceneImage } from '@/services/imageService';
import { isUiV2Enabled } from '@/lib/uiV2';
import { useBreakpoint } from '@/hooks/useBreakpoint';

const IMAGE_FEATURE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_IMAGE_GENERATION === 'true';

const PANEL = 'rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-2xl shadow-[0_35px_90px_rgba(0,0,0,0.65)]';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface SliderProps {
    id: keyof GenerationConfig | 'volume';
    label: string;
    tooltip: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

const Slider: React.FC<SliderProps> = ({ id, label, tooltip, value, min, max, step, onChange }) => (
    <div>
        <div className="flex justify-between items-center mb-2">
            <label htmlFor={id} className="text-stone-100 font-semibold flex items-center gap-2">
                {label}
                <div className="relative group">
                    <Info className="h-4 w-4 text-stone-500 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-black/90 text-stone-200 text-xs rounded-2xl py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg border border-white/10">
                        {tooltip}
                    </div>
                </div>
            </label>
            <span className="font-mono text-amber-300">{value}</span>
        </div>
        <input
            id={id}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={onChange}
            className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/10 accent-amber-400"
        />
    </div>
);

const AudioControls: React.FC = () => {
    const { volume, setVolume, isMuted, setIsMuted, playMenuMusic, setPlayMenuMusic, playAmbientMusic, setPlayAmbientMusic } = useSettingsContext();
    const { autoSpeak, setAutoSpeak } = useNarrationSpeech();

    return (
         <div className="space-y-4 pt-6 border-t border-white/10">
            <h3 className="text-lg font-semibold text-stone-100">Áudio</h3>
            <div className="flex items-center gap-3">
                 <button onClick={() => setIsMuted(m => !m)} className="text-stone-200 hover:text-white p-2 rounded-full bg-black/40 border border-white/10 hover:border-amber-400/40 transition-colors">
                    {isMuted ? <VolumeX size={20}/> : <Volume2 size={20} />}
                </button>
                 <Slider 
                    id="volume"
                    label="Volume Geral"
                    tooltip="Ajusta o volume da narração e dos sons de ambiente no jogo."
                    value={Math.round(volume * 100)}
                    min={0}
                    max={100}
                    step={5}
                    onChange={(e) => setVolume(Number(e.target.value) / 100)}
                />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between bg-black/30 border border-white/10 p-4 rounded-2xl">
                    <label htmlFor="menu-music-toggle" className="text-stone-200 font-semibold text-sm">
                        Música da Tela Principal
                    </label>
                    <button
                        id="menu-music-toggle"
                        onClick={() => setPlayMenuMusic(p => !p)}
                        className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-amber-500 ${playMenuMusic ? 'bg-amber-500' : 'bg-stone-600'}`}
                    >
                        <span
                            aria-hidden="true"
                            className={`inline-block h-5 w-5 rounded-full bg-white shadow-lg transform ring-0 transition ease-in-out duration-200 ${playMenuMusic ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                    </button>
                </div>
                <div className="flex items-center justify-between bg-black/30 border border-white/10 p-4 rounded-2xl">
                    <label htmlFor="ambient-music-toggle" className="text-stone-200 font-semibold text-sm">
                        Música ambiente na aventura
                    </label>
                    <button
                        id="ambient-music-toggle"
                        onClick={() => setPlayAmbientMusic(p => !p)}
                        className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-emerald-500 ${playAmbientMusic ? 'bg-emerald-500' : 'bg-stone-600'}`}
                    >
                        <span
                            aria-hidden="true"
                            className={`inline-block h-5 w-5 rounded-full bg-white shadow-lg transform ring-0 transition ease-in-out duration-200 ${playAmbientMusic ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                    </button>
                </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold text-stone-100">Narração automática</p>
                        <p className="text-xs text-stone-400">Usa o TTS do servidor para falar cada novo bloco assim que ele chega.</p>
                    </div>
                    <Switch checked={autoSpeak} onCheckedChange={setAutoSpeak} />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => {
                            window.dispatchEvent(new Event('narration-play-request'));
                        }}
                        className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-stone-100 hover:border-amber-300/50 hover:text-amber-200"
                    >
                        Ouvir última narração
                    </button>
                </div>
            </div>
        </div>
    )
}

const themeOptions: Array<{ id: ThemePreset; title: string; description: string; gradient: string }> = [
    { id: 'classic', title: 'Stone', description: 'Âmbar + pedra (visual original)', gradient: 'from-stone-900 via-stone-800 to-amber-800' },
    { id: 'aurora', title: 'Aurora', description: 'Crepúsculo vibrante e quente', gradient: 'from-rose-900 via-purple-700 to-sky-600' },
    { id: 'midnight', title: 'Midnight', description: 'Noite profunda com contraste frio', gradient: 'from-indigo-950 via-slate-900 to-cyan-900' },
];

const ToggleRow: React.FC<{
    id: string;
    label: string;
    description?: string;
    enabled: boolean;
    onToggle: () => void;
}> = ({ id, label, description, enabled, onToggle }) => (
    <div className="flex items-start justify-between gap-4 bg-black/30 rounded-2xl p-4 border border-white/10">
        <div>
            <p className="text-sm font-semibold text-stone-100">{label}</p>
            {description && <p className="text-xs text-stone-400 mt-0.5">{description}</p>}
        </div>
        <button
            id={id}
            onClick={onToggle}
            className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-amber-500 ${enabled ? 'bg-amber-500' : 'bg-stone-600'}`}
        >
            <span
                aria-hidden="true"
                className={`inline-block h-5 w-5 rounded-full bg-white shadow-lg transform ring-0 transition ease-in-out duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
            />
        </button>
    </div>
);

const AppearanceControls: React.FC = () => {
    const {
        theme,
        setTheme,
        fontScale,
        setFontScale,
        reducedMotion,
        setReducedMotion,
        highContrast,
        setHighContrast,
        hasSeenGuidedTips,
        setHasSeenGuidedTips,
    } = useSettingsContext();

    const sliderValue = useMemo(() => Math.max(themeOptions.findIndex(option => option.id === theme), 0), [theme]);

    return (
        <div className="space-y-4 pt-6 border-t border-white/10">
            <h3 className="text-lg font-semibold text-stone-100 flex items-center gap-2">
                <Palette className="h-5 w-5 text-amber-400" /> Aparência & Acessibilidade
            </h3>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 text-sm text-stone-200">
                    <span>Paleta dinâmica</span>
                    <Sparkles className="h-4 w-4 text-amber-300" />
                </div>
                <input
                    type="range"
                    min={0}
                    max={themeOptions.length - 1}
                    value={sliderValue}
                    onChange={(event) => {
                        const nextIdx = Number(event.target.value);
                        const selected = themeOptions[nextIdx];
                        if (selected) setTheme(selected.id);
                    }}
                    className="w-full accent-amber-400"
                    aria-label="Selecionar tema visual"
                />
                <div className="grid grid-cols-3 gap-2 text-xs text-center">
                    {themeOptions.map(option => (
                        <button
                            key={option.id}
                            onClick={() => setTheme(option.id)}
                            className={`rounded-xl border p-2 transition-all ${
                                option.id === theme
                                    ? 'border-amber-400 text-amber-200 bg-black/40'
                                    : 'border-white/10 text-stone-400 hover:border-amber-500/60'
                            }`}
                        >
                            <div className={`h-8 rounded bg-gradient-to-r ${option.gradient} mb-1`} />
                            <p className="font-semibold">{option.title}</p>
                            <p className="text-[10px] text-stone-400">{option.description}</p>
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <ToggleRow
                    id="reading-mode"
                    label="Modo Leitura"
                    description="Aumenta tipografia para sessões longas."
                    enabled={fontScale === 'reading'}
                    onToggle={() => setFontScale(fontScale === 'reading' ? 'normal' : 'reading')}
                />
                <ToggleRow
                    id="reduced-motion"
                    label="Animações Reduzidas"
                    description="Torna as transições mais sutis."
                    enabled={reducedMotion}
                    onToggle={() => setReducedMotion(!reducedMotion)}
                />
                <ToggleRow
                    id="high-contrast"
                    label="Alto Contraste"
                    description="Refina bordas e textos para ambientes claros."
                    enabled={highContrast}
                    onToggle={() => setHighContrast(!highContrast)}
                />
                <div className="flex flex-col gap-2 bg-black/30 rounded-2xl p-4 border border-white/10">
                    <div className="flex items-center gap-2 text-sm font-semibold text-stone-100">
                        <Accessibility className="h-4 w-4 text-amber-300" /> Guia Interativo
                    </div>
                    <p className="text-xs text-stone-400">
                        Reabra o tour guiado que explica cada painel da mesa virtual.
                    </p>
                    <button
                        onClick={() => setHasSeenGuidedTips(false)}
                        className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-400 text-amber-200 hover:bg-amber-500/10 disabled:opacity-60"
                        disabled={!hasSeenGuidedTips}
                    >
                        <Undo2 className="h-3.5 w-3.5" /> Rever dicas
                    </button>
                </div>
            </div>
        </div>
    );
};

const FeedbackControls: React.FC = () => {
    const { eventCuesEnabled, setEventCuesEnabled, hapticsEnabled, setHapticsEnabled } = useSettingsContext();
    return (
        <div className="space-y-4 pt-6 border-t border-white/10">
            <h3 className="text-lg font-semibold text-stone-100 flex items-center gap-2">
                <AudioWaveform className="h-5 w-5 text-amber-300" /> Feedback Sensorial
            </h3>
            <ToggleRow
                id="audio-cues"
                label="Alertas sonoros"
                description="Dispara um breve tom quando você ganha XP, saqueia itens ou altera relações."
                enabled={eventCuesEnabled}
                onToggle={() => setEventCuesEnabled(!eventCuesEnabled)}
            />
            <ToggleRow
                id="haptics-cues"
                label="Vibração discreta"
                description="Requer suporte do navegador/dispositivo."
                enabled={hapticsEnabled}
                onToggle={() => setHapticsEnabled(!hapticsEnabled)}
            />
        </div>
    );
};

const CacheManagement: React.FC = () => {
    const { user, invalidateUserCache } = useAuth();
    const { toast } = useToast();
    const [isFlushingRedis, setIsFlushingRedis] = useState(false);
    const [isClearingRolls, setIsClearingRolls] = useState(false);

    const handleClearEquipmentCache = () => {
        sessionStorage.removeItem('equipmentCache');
        toast({ title: 'Cache Limpo!', description: 'O cache de equipamentos foi limpo. Recarregue a página se necessário.'});
        window.location.reload();
    };

    const handleSyncHomebrew = async () => {
        try {
            await invalidateUserCache();
            toast({ title: 'Sincronização Solicitada!', description: 'O cache do seu usuário e homebrews foi invalidado no servidor.'});
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Falha na Sincronização', description: error.message });
        }
    };

    const handleFlushRedis = async () => {
        setIsFlushingRedis(true);
        try {
            const response = await fetch('/api/cache/flush', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
                },
            });
            if (!response.ok) {
                const msg = await response.text();
                throw new Error(msg || 'Falha ao limpar caches globais.');
            }
            const body = await response.json();
            toast({
                title: 'Cache global limpo!',
                description: body.message || 'Todos os caches foram limpos no servidor.',
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Não foi possível limpar o cache global',
                description: error.message,
            });
        } finally {
            setIsFlushingRedis(false);
        }
    };

    const handleClearPendingRolls = async () => {
        setIsClearingRolls(true);
        try {
            await apiClient('/roll-requests/clear', { method: 'POST' });
            toast({
                title: 'Rolagens pendentes limpas!',
                description: 'Nenhuma rolagem bloqueada permanece nas suas sessões.',
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Não foi possível limpar as rolagens',
                description: error?.message || 'Tente novamente em instantes.',
            });
        } finally {
            setIsClearingRolls(false);
        }
    };

    return (
        <div className="space-y-4 pt-6 border-t border-white/10">
            <h3 className="text-lg font-semibold text-stone-100">Manutenção e Cache</h3>
            <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={handleClearEquipmentCache} className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-full text-sm font-semibold transition bg-gradient-to-r from-sky-400 to-sky-600 text-stone-900 hover:from-sky-300 hover:to-sky-500">
                    <Eraser className="h-4 w-4" /> Limpar Cache de Equipamentos
                </button>
                 <button onClick={handleSyncHomebrew} className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-full text-sm font-semibold transition bg-gradient-to-r from-purple-400 to-purple-600 text-white hover:from-purple-300 hover:to-purple-500">
                    <RefreshCw className="h-4 w-4" /> Sincronizar Dados de Homebrew
                </button>
            </div>
            <button
                onClick={handleClearPendingRolls}
                disabled={isClearingRolls}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-full text-sm font-semibold transition bg-gradient-to-r from-emerald-500 to-teal-600 text-white disabled:opacity-50"
            >
                {isClearingRolls ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dice5 className="h-4 w-4" />}
                Limpar Rolagens Pendentes
            </button>
            {user?.id === 1 && (
                <button
                    onClick={handleFlushRedis}
                    disabled={isFlushingRedis}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-full text-sm font-semibold transition bg-gradient-to-r from-rose-500 to-red-600 text-white disabled:opacity-50"
                    title="Limpa todos os caches compartilhados (Redis). Use apenas quando necessário."
                >
                    {isFlushingRedis ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Limpar Caches Globais
                </button>
            )}
             <p className="text-xs text-stone-400 text-center">Use estas opções se notar que itens, equipamentos ou conteúdos homebrew não estão aparecendo ou atualizando corretamente.</p>
        </div>
    );
};


const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { isMdUp } = useBreakpoint();
    const useSheetLayout = isUiV2Enabled();
    const { 
        model, setModel, 
        ttsModel, setTtsModel, 
        ttsVoice, setTtsVoice, 
        apiKey, setApiKey, 
        generationConfig, setGenerationConfig,
        useAiHomebrew, setUseAiHomebrew
    } = useSettingsContext();
    const { toast } = useToast();
    const [imageTestPrompt, setImageTestPrompt] = useState('Retrate a cena atual como uma ilustração dramática.');
    const [imageTestLoading, setImageTestLoading] = useState(false);
    const [imageTestResult, setImageTestResult] = useState<{ url?: string; imageKey?: string; error?: string } | null>(null);
    
    if (!isOpen) return null;
    
    const handleConfigChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setGenerationConfig(prev => ({
            ...prev,
            [id]: Number(value),
        }));
    };

    const handleSaveAndClose = () => {
        onClose();
    }

    const handleTestImageGeneration = async () => {
        if (!IMAGE_FEATURE_ENABLED) return;
        const prompt = imageTestPrompt.trim();
        const trimmedKey = (apiKey || '').trim();
        if (!prompt) {
            toast({ variant: 'destructive', description: 'Informe um prompt para gerar a imagem.' });
            return;
        }
        if (!trimmedKey) {
            toast({ variant: 'destructive', description: 'Configure sua chave do Google AI antes de testar imagens.' });
            return;
        }
        setImageTestLoading(true);
        setImageTestResult(null);
        try {
            const response = await requestSceneImage(prompt, trimmedKey);
            setImageTestResult({ url: response.imageUrl, imageKey: response.imageKey });
            toast({ title: 'Imagem gerada!', description: 'Abra o preview abaixo para validar a cena.' });
        } catch (error: any) {
            const message = error?.message || 'Falha ao gerar imagem. Verifique a chave e tente novamente.';
            setImageTestResult({ error: message });
            toast({ variant: 'destructive', title: 'Erro ao gerar imagem', description: message });
        } finally {
            setImageTestLoading(false);
        }
    };

    const panelContent = (
            <div 
                className={`${useSheetLayout ? 'dnd-surface-glass border border-dnd-gold/20 shadow-[var(--dnd-shadow-elevated)]' : PANEL} w-full flex flex-col overflow-hidden ${useSheetLayout ? (isMdUp ? 'h-full max-w-md' : 'max-h-[90vh]') : 'max-w-4xl max-h-[92vh]'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <header className="p-6 border-b border-white/10 flex justify-between items-start gap-4">
                    <div className="space-y-2">
                        <p className="text-[11px] uppercase tracking-[0.35em] text-amber-200 flex items-center gap-2">
                            <Shield className="h-4 w-4" /> Configurações Avançadas
                        </p>
                        <h2 className="text-3xl font-serif text-white leading-tight">Painel do Mestre Virtual</h2>
                        <p className="text-sm text-stone-400">Personalize áudio, IA, aparências e integrações para toda a mesa.</p>
                    </div>
                    <button onClick={handleSaveAndClose} className="rounded-full border border-white/15 p-2 text-stone-300 hover:text-white hover:border-white/40 transition" aria-label="Fechar configurações">
                        &times;
                    </button>
                </header>
                <main className="p-6 space-y-6 overflow-y-auto min-h-0">
                     <div>
                        <div className="flex justify-between items-center mb-2">
                           <label htmlFor="api-key-input" className="text-stone-300 font-semibold flex items-center gap-2">
                              <KeyRound className="h-4 w-4"/> Chave OpenRouter (jogo)
                           </label>
                           <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 hover:text-amber-300 underline">
                              Criar chave
                           </a>
                    </div>
                     <input
                        id="api-key-input"
                        type="password"
                        value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="sk-or-v1-..."
                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-3 text-stone-100 focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                        />
                         <p className="text-xs text-stone-500 mt-2">
                            Salva só no seu navegador. Modelos free no OpenRouter; Gemini opcional para voz e imagens (chave Google separada).
                        </p>
                    </div>
                    {IMAGE_FEATURE_ENABLED && (
                        <div className="rounded-3xl border border-white/10 bg-black/30 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-stone-100 flex items-center gap-2">
                                        <ImageIcon className="h-4 w-4 text-amber-400" />
                                        Teste de geração de imagem
                                    </p>
                                    <p className="text-xs text-stone-400">Use o prompt abaixo para validar rapidamente se sua chave está habilitada para o modelo de imagens.</p>
                                </div>
                                {imageTestLoading && <Loader2 className="h-4 w-4 animate-spin text-amber-200" />}
                            </div>
                            <textarea
                                value={imageTestPrompt}
                                onChange={e => setImageTestPrompt(e.target.value)}
                                rows={3}
                                className="w-full rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-stone-100 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/60"
                                placeholder="Descreva a cena que deseja visualizar..."
                            />
                            <div className="flex flex-col gap-3">
                                <button
                                    type="button"
                                    onClick={handleTestImageGeneration}
                                    disabled={imageTestLoading}
                                    className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-pink-500 py-2.5 px-4 text-sm font-semibold text-white transition hover:from-amber-400 hover:to-pink-400 disabled:opacity-50"
                                >
                                    {imageTestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                    Gerar imagem de teste
                                </button>
                                {imageTestResult?.url && (
                                    <a
                                        href={imageTestResult.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block overflow-hidden rounded-2xl border border-white/10 bg-black/50"
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={imageTestResult.url} alt="Prévia da imagem gerada" className="w-full object-cover" />
                                    </a>
                                )}
                                {imageTestResult?.error && (
                                    <p className="text-xs text-rose-300">
                                        {imageTestResult.error}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    <AudioControls />
                    <AppearanceControls />
                    <FeedbackControls />

                    <div className="space-y-4 pt-6 border-t border-white/10">
                        <h3 className="text-lg font-semibold text-stone-100">Homebrew e IA</h3>
                         <div className="flex items-center justify-between bg-black/30 border border-white/10 p-4 rounded-2xl">
                            <label htmlFor="ai-homebrew-toggle" className="flex flex-col cursor-pointer text-stone-200">
                                <span className="font-semibold flex items-center gap-2">
                                    <FlaskConical className="h-4 w-4 text-purple-400" />
                                    Permitir que a IA crie Homebrew
                                </span>
                                <span className="text-xs text-stone-400">Permitir que a IA crie e reutilize itens, NPCs e locais em suas sessões.</span>
                            </label>
                            <button
                                id="ai-homebrew-toggle"
                                onClick={() => setUseAiHomebrew(p => !p)}
                                className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-amber-500 ${useAiHomebrew ? 'bg-amber-500' : 'bg-stone-600'}`}
                            >
                                <span
                                    aria-hidden="true"
                                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-lg transform ring-0 transition ease-in-out duration-200 ${useAiHomebrew ? 'translate-x-5' : 'translate-x-0'}`}
                                />
                            </button>
                        </div>
                    </div>


                    <div className="space-y-4 pt-4 border-t border-stone-700/50">
                        <h3 className="text-lg font-semibold text-stone-300">Modelos de IA</h3>
                         <div>
                            <label htmlFor="ai-model-select" className="block text-stone-300 font-semibold mb-2">
                                Modelo do Mestre
                            </label>
                            <select
                                id="ai-model-select"
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl p-3 text-stone-100 focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                            >
                                {AVAILABLE_MODELS.map(modelName => (
                                    <option key={modelName} value={modelName}>
                                        {modelName}
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <div>
                            <label htmlFor="tts-model-select" className="block text-stone-300 font-semibold mb-2">
                                Modelo de Voz (TTS)
                            </label>
                            <select
                                id="tts-model-select"
                                value={ttsModel}
                                onChange={(e) => setTtsModel(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl p-3 text-stone-100 focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                            >
                                {AVAILABLE_TTS_MODELS.map(modelName => (
                                    <option key={modelName} value={modelName}>
                                        {modelName}
                                    </option>
                                ))}
                            </select>
                        </div>

                         <div>
                            <label htmlFor="tts-voice-select" className="block text-stone-300 font-semibold mb-2">
                                Voz do Narrador (TTS)
                            </label>
                            <select
                                id="tts-voice-select"
                                value={ttsVoice}
                                onChange={(e) => setTtsVoice(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl p-3 text-stone-100 focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                            >
                                {AVAILABLE_TTS_VOICES.map(voiceName => (
                                    <option key={voiceName} value={voiceName}>
                                        {voiceName}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>


                    <div className="space-y-4 pt-4 border-t border-stone-700/50">
                         <h3 className="text-lg font-semibold text-stone-300">Parâmetros da IA</h3>
                        <Slider 
                            id="temperature"
                            label="Temperatura"
                            tooltip="A 'Inspiração' do Mestre. Valores altos o tornam mais criativo e imprevisível. Valores baixos o mantêm mais focado e direto."
                            value={generationConfig.temperature}
                            min={0} max={1} step={0.05}
                            onChange={handleConfigChange}
                        />
                         <Slider 
                            id="topP"
                            label="Top-P"
                            tooltip="A 'Confiança' do Mestre. Um valor alto permite que ele considere palavras mais ousadas e incomuns. Um valor baixo o limita às palavras mais seguras e prováveis."
                            value={generationConfig.topP}
                            min={0} max={1} step={0.05}
                            onChange={handleConfigChange}
                        />
                         <Slider 
                            id="topK"
                            label="Top-K"
                            tooltip="O 'Foco' do Mestre. Limita o número de palavras que ele considera a cada passo. Um valor baixo o torna mais repetitivo e previsível; um valor alto aumenta a variedade."
                            value={generationConfig.topK}
                            min={1} max={100} step={1}
                            onChange={handleConfigChange}
                        />
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-2">
                            <p className="text-sm font-semibold text-stone-100">Tamanho da Resposta (Automático)</p>
                            <p className="text-xs text-stone-400 leading-relaxed">
                                O sistema ajusta dinamicamente o limite de tokens de saída com base no tamanho do prompt e no modelo escolhido.
                                Dessa forma você evita desperdício de créditos e garante respostas completas sem precisar configurar nada.
                            </p>
                        </div>
                    </div>
                    
                    <CacheManagement />


                </main>
                <footer className="p-5 flex justify-end items-center gap-4 border-t border-white/10 bg-black/30">
                    <button
                        onClick={handleSaveAndClose}
                        className="px-6 py-2.5 rounded-full font-semibold text-stone-900 bg-gradient-to-r from-amber-300 to-amber-500 hover:from-amber-200 hover:to-amber-400 transition-colors"
                    >
                        Fechar
                    </button>
                </footer>
            </div>
    );

    if (useSheetLayout) {
        return (
            <>
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                    onClick={handleSaveAndClose}
                    aria-hidden
                />
                <div
                    className={`fixed z-50 flex flex-col ${
                        isMdUp
                            ? 'right-0 top-0 h-full w-full max-w-md border-l border-dnd-gold/20 pt-[var(--dnd-safe-top)]'
                            : 'inset-x-0 bottom-0 rounded-t-xl border-t border-dnd-gold/20 pb-[var(--dnd-safe-bottom)]'
                    }`}
                >
                    {panelContent}
                </div>
            </>
        );
    }

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#04060a]/90 backdrop-blur animate-fadeIn p-4"
            style={{ animationDuration: '200ms' }}
            onClick={handleSaveAndClose}
        >
            {panelContent}
        </div>
    );
};

export default SettingsModal;
