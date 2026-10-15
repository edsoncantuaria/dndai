// src/components/SettingsModal.tsx
'use client';

import React, { ChangeEvent, useMemo, useState } from 'react';
import { useSettingsContext, ThemePreset } from '../contexts/SettingsContext';
import { Info, KeyRound, Volume2, VolumeX, FlaskConical, RefreshCw, Eraser, Palette, Sparkles, Accessibility, Undo2, AudioWaveform, Loader2, Shield, Dice5, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { useNarrationSpeech } from '@/hooks/useNarrationSpeech';
import { apiClient } from '@/services/apiClient';
import { generateSceneImage as requestSceneImage } from '@/services/imageService';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { NARRATION_PLAYBACK_RATE, PIPER_VOICES } from '@/lib/narrationTts';
import { AiBillingSection } from '@/components/settings/AiBillingSection';

const IMAGE_FEATURE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_IMAGE_GENERATION === 'true';

const PANEL =
  'rounded-3xl border border-dnd-gold/15 bg-dnd-obsidian-raised/95 backdrop-blur-2xl shadow-[var(--dnd-shadow-elevated)]';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface SliderProps {
    id: string;
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
            <label htmlFor={id} className="text-dnd-parchment font-semibold flex items-center gap-2">
                {label}
                <div className="relative group">
                    <Info className="h-4 w-4 text-dnd-parchment-muted/80 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-black/90 text-dnd-parchment text-xs rounded-2xl py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg border border-white/10">
                        {tooltip}
                    </div>
                </div>
            </label>
            <span className="font-mono text-dnd-gold">{value}</span>
        </div>
        <input
            id={id}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={onChange}
            className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/10 accent-dnd-gold"
        />
    </div>
);

const AudioControls: React.FC = () => {
    const {
        volume,
        setVolume,
        isMuted,
        setIsMuted,
        playMenuMusic,
        setPlayMenuMusic,
        playAmbientMusic,
        setPlayAmbientMusic,
    } = useSettingsContext();
    const { autoSpeak, setAutoSpeak } = useNarrationSpeech();
    return (
         <div className="space-y-4 pt-6 border-t border-white/10">
            <h3 className="text-lg font-semibold text-dnd-parchment">Áudio e narração</h3>
            <div className="flex items-center gap-3">
                 <button onClick={() => setIsMuted(m => !m)} className="text-dnd-parchment hover:text-dnd-parchment p-2 rounded-full bg-black/40 border border-white/10 hover:border-dnd-gold/40 transition-colors">
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
                    <label htmlFor="menu-music-toggle" className="text-dnd-parchment font-semibold text-sm">
                        Música da Tela Principal
                    </label>
                    <button
                        id="menu-music-toggle"
                        onClick={() => setPlayMenuMusic(p => !p)}
                        className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-dnd-gold ${playMenuMusic ? 'bg-dnd-gold' : 'bg-dnd-obsidian-raised'}`}
                    >
                        <span
                            aria-hidden="true"
                            className={`inline-block h-5 w-5 rounded-full bg-white shadow-lg transform ring-0 transition ease-in-out duration-200 ${playMenuMusic ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                    </button>
                </div>
                <div className="flex items-center justify-between bg-black/30 border border-white/10 p-4 rounded-2xl">
                    <label htmlFor="ambient-music-toggle" className="text-dnd-parchment font-semibold text-sm">
                        Música ambiente na aventura
                    </label>
                    <button
                        id="ambient-music-toggle"
                        onClick={() => setPlayAmbientMusic(p => !p)}
                        className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-emerald-500 ${playAmbientMusic ? 'bg-emerald-500' : 'bg-dnd-obsidian-raised'}`}
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
                        <p className="text-sm font-semibold text-dnd-parchment">Narração automática</p>
                        <p className="text-xs text-dnd-parchment-muted">Usa o TTS do servidor para falar cada novo bloco assim que ele chega.</p>
                    </div>
                    <Switch checked={autoSpeak} onCheckedChange={setAutoSpeak} />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => {
                            window.dispatchEvent(new Event('narration-play-request'));
                        }}
                        className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-dnd-parchment hover:border-dnd-gold/50 hover:text-dnd-gold"
                    >
                        Ouvir última narração
                    </button>
                </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-sm font-semibold text-dnd-parchment">Narrador Piper</p>
                <p className="mt-1 text-xs text-dnd-parchment-muted">
                    Voz <span className="text-dnd-gold">{PIPER_VOICES[0]?.label ?? 'Faber'}</span>
                    {' · '}
                    velocidade {NARRATION_PLAYBACK_RATE.toFixed(2).replace('.', ',')}×
                </p>
                <p className="mt-1 text-xs text-dnd-parchment-muted/80">
                    {PIPER_VOICES[0]?.description}
                </p>
            </div>
        </div>
    )
}

const themeOptions: Array<{ id: ThemePreset; title: string; description: string; gradient: string }> = [
    { id: 'classic', title: 'Obsidian', description: 'Ouro + obsidiana (V3)', gradient: 'from-dnd-obsidian via-dnd-obsidian-raised to-dnd-gold/40' },
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
            <p className="text-sm font-semibold text-dnd-parchment">{label}</p>
            {description && <p className="text-xs text-dnd-parchment-muted mt-0.5">{description}</p>}
        </div>
        <button
            id={id}
            onClick={onToggle}
            className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-dnd-gold ${enabled ? 'bg-dnd-gold' : 'bg-dnd-obsidian-raised'}`}
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
            <h3 className="text-lg font-semibold text-dnd-parchment flex items-center gap-2">
                <Palette className="h-5 w-5 text-dnd-gold" /> Aparência & Acessibilidade
            </h3>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 text-sm text-dnd-parchment">
                    <span>Paleta dinâmica</span>
                    <Sparkles className="h-4 w-4 text-dnd-gold" />
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
                    className="w-full accent-dnd-gold"
                    aria-label="Selecionar tema visual"
                />
                <div className="grid grid-cols-3 gap-2 text-xs text-center">
                    {themeOptions.map(option => (
                        <button
                            key={option.id}
                            onClick={() => setTheme(option.id)}
                            className={`rounded-xl border p-2 transition-all ${
                                option.id === theme
                                    ? 'border-dnd-gold text-dnd-gold bg-black/40'
                                    : 'border-white/10 text-dnd-parchment-muted hover:border-dnd-gold/60'
                            }`}
                        >
                            <div className={`h-8 rounded bg-gradient-to-r ${option.gradient} mb-1`} />
                            <p className="font-semibold">{option.title}</p>
                            <p className="text-[10px] text-dnd-parchment-muted">{option.description}</p>
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
                    <div className="flex items-center gap-2 text-sm font-semibold text-dnd-parchment">
                        <Accessibility className="h-4 w-4 text-dnd-gold" /> Guia Interativo
                    </div>
                    <p className="text-xs text-dnd-parchment-muted">
                        Reabra o tour guiado que explica cada painel da mesa virtual.
                    </p>
                    <button
                        onClick={() => setHasSeenGuidedTips(false)}
                        className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border border-dnd-gold text-dnd-gold hover:bg-dnd-gold/10 disabled:opacity-60"
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
            <h3 className="text-lg font-semibold text-dnd-parchment flex items-center gap-2">
                <AudioWaveform className="h-5 w-5 text-dnd-gold" /> Feedback Sensorial
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
            const { apiClient } = await import('@/services/apiClient');
            const body = await apiClient<{ message?: string }>('/cache/flush', { method: 'POST' });
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
            <h3 className="text-lg font-semibold text-dnd-parchment">Manutenção e Cache</h3>
            <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={handleClearEquipmentCache} className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-full text-sm font-semibold transition bg-gradient-to-r from-sky-400 to-sky-600 text-dnd-obsidian hover:from-sky-300 hover:to-sky-500">
                    <Eraser className="h-4 w-4" /> Limpar Cache de Equipamentos
                </button>
                 <button onClick={handleSyncHomebrew} className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-full text-sm font-semibold transition bg-gradient-to-r from-purple-400 to-purple-600 text-dnd-parchment hover:from-purple-300 hover:to-purple-500">
                    <RefreshCw className="h-4 w-4" /> Sincronizar Dados de Homebrew
                </button>
            </div>
            <button
                onClick={handleClearPendingRolls}
                disabled={isClearingRolls}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-full text-sm font-semibold transition bg-gradient-to-r from-emerald-500 to-teal-600 text-dnd-parchment disabled:opacity-50"
            >
                {isClearingRolls ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dice5 className="h-4 w-4" />}
                Limpar Rolagens Pendentes
            </button>
            {user?.id === 1 && (
                <button
                    onClick={handleFlushRedis}
                    disabled={isFlushingRedis}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-full text-sm font-semibold transition bg-gradient-to-r from-dnd-ember to-dnd-ember/90 text-dnd-parchment disabled:opacity-50"
                    title="Limpa todos os caches compartilhados (Redis). Use apenas quando necessário."
                >
                    {isFlushingRedis ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Limpar Caches Globais
                </button>
            )}
             <p className="text-xs text-dnd-parchment-muted text-center">Use estas opções se notar que itens, equipamentos ou conteúdos homebrew não estão aparecendo ou atualizando corretamente.</p>
        </div>
    );
};


const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { isMdUp } = useBreakpoint();
    const useSheetLayout = true;
    const { useAiHomebrew, setUseAiHomebrew, persistSettingsNow } = useSettingsContext();
    const { toast } = useToast();
    const [imageTestPrompt, setImageTestPrompt] = useState('Retrate a cena atual como uma ilustração dramática.');
    const [imageTestLoading, setImageTestLoading] = useState(false);
    const [imageTestResult, setImageTestResult] = useState<{ url?: string; imageKey?: string; error?: string } | null>(null);
    
    if (!isOpen) return null;
    
    const handleSaveAndClose = async () => {
        try {
            await persistSettingsNow();
        } catch (error) {
            console.error('[SettingsModal] Falha ao salvar configurações:', error);
            toast({
                variant: 'destructive',
                title: 'Não foi possível salvar',
                description: 'Suas preferências ficaram neste dispositivo, mas não sincronizaram com a conta. Tente de novo.',
            });
        }
        onClose();
    };

    const handleTestImageGeneration = async () => {
        if (!IMAGE_FEATURE_ENABLED) return;
        const prompt = imageTestPrompt.trim();
        if (!prompt) {
            toast({ variant: 'destructive', description: 'Informe um prompt para gerar a imagem.' });
            return;
        }
        setImageTestLoading(true);
        setImageTestResult(null);
        try {
            const response = await requestSceneImage(prompt, '');
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
                        <p className="text-[11px] uppercase tracking-[0.35em] text-dnd-gold flex items-center gap-2">
                            <Shield className="h-4 w-4" /> Configurações Avançadas
                        </p>
                        <h2 className="text-3xl font-serif text-dnd-parchment leading-tight">Painel do Mestre Virtual</h2>
                        <p className="text-sm text-dnd-parchment-muted">Personalize áudio, IA, aparências e integrações para toda a mesa.</p>
                    </div>
                    <button onClick={handleSaveAndClose} className="rounded-full border border-white/15 p-2 text-dnd-parchment-muted hover:text-dnd-parchment hover:border-white/40 transition" aria-label="Fechar configurações">
                        &times;
                    </button>
                </header>
                <main className="p-6 space-y-6 overflow-y-auto min-h-0">
                    <p className="text-sm text-dnd-parchment-muted rounded-2xl border border-white/10 bg-black/30 p-4">
                        A IA e a voz do Mestre rodam no servidor — basta entrar e jogar. Ajuste áudio e aparência abaixo.
                    </p>
                    {IMAGE_FEATURE_ENABLED && (
                        <div className="rounded-3xl border border-white/10 bg-black/30 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-dnd-parchment flex items-center gap-2">
                                        <ImageIcon className="h-4 w-4 text-dnd-gold" />
                                        Teste de geração de imagem
                                    </p>
                                    <p className="text-xs text-dnd-parchment-muted">Use o prompt abaixo para validar rapidamente se sua chave está habilitada para o modelo de imagens.</p>
                                </div>
                                {imageTestLoading && <Loader2 className="h-4 w-4 animate-spin text-dnd-gold" />}
                            </div>
                            <textarea
                                value={imageTestPrompt}
                                onChange={e => setImageTestPrompt(e.target.value)}
                                rows={3}
                                className="w-full rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-dnd-parchment focus:border-dnd-gold focus:ring-2 focus:ring-dnd-gold/60"
                                placeholder="Descreva a cena que deseja visualizar..."
                            />
                            <div className="flex flex-col gap-3">
                                <button
                                    type="button"
                                    onClick={handleTestImageGeneration}
                                    disabled={imageTestLoading}
                                    className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-dnd-gold to-dnd-ember py-2.5 px-4 text-sm font-semibold text-dnd-parchment transition hover:brightness-110 disabled:opacity-50"
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
                                    <p className="text-xs text-dnd-ember">
                                        {imageTestResult.error}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    <AudioControls />
                    <AiBillingSection />
                    <AppearanceControls />
                    <FeedbackControls />

                    <div className="space-y-4 pt-6 border-t border-white/10">
                        <h3 className="text-lg font-semibold text-dnd-parchment">Homebrew e IA</h3>
                         <div className="flex items-center justify-between bg-black/30 border border-white/10 p-4 rounded-2xl">
                            <label htmlFor="ai-homebrew-toggle" className="flex flex-col cursor-pointer text-dnd-parchment">
                                <span className="font-semibold flex items-center gap-2">
                                    <FlaskConical className="h-4 w-4 text-purple-400" />
                                    Permitir que a IA crie Homebrew
                                </span>
                                <span className="text-xs text-dnd-parchment-muted">Permitir que a IA crie e reutilize itens, NPCs e locais em suas sessões.</span>
                            </label>
                            <button
                                id="ai-homebrew-toggle"
                                onClick={() => setUseAiHomebrew(p => !p)}
                                className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-dnd-gold ${useAiHomebrew ? 'bg-dnd-gold' : 'bg-dnd-obsidian-raised'}`}
                            >
                                <span
                                    aria-hidden="true"
                                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-lg transform ring-0 transition ease-in-out duration-200 ${useAiHomebrew ? 'translate-x-5' : 'translate-x-0'}`}
                                />
                            </button>
                        </div>
                    </div>

                    <CacheManagement />


                </main>
                <footer className="p-5 flex justify-end items-center gap-4 border-t border-white/10 bg-black/30">
                    <button
                        onClick={handleSaveAndClose}
                        className="px-6 py-2.5 rounded-full font-semibold text-dnd-obsidian bg-dnd-gold hover:brightness-110 transition-colors"
                    >
                        Salvar e fechar
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
