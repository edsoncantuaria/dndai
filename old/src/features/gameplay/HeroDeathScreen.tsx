'use client';

import { useCallback, useState } from 'react';
import { Skull } from 'lucide-react';
import { DndButton } from '@/components/primitives';
import {
    exportSessionHeroToVault,
    resetVaultHeroProgress,
} from '@/services/penaiApi';
import { createAndLoadPenaiSession } from '@/lib/penaiCharacterAdapter';
import { useToast } from '@/hooks/use-toast';

export type HeroDeathPayload = {
    heroName: string;
    level: number;
    vaultTemplateId?: string | null;
    reason?: string;
};

export function HeroDeathScreen({
    sessionId,
    payload,
    userId,
    onReturnToHub,
    onNewHero,
    onResumePlaying,
}: {
    sessionId: number;
    payload: HeroDeathPayload;
    userId: number;
    onReturnToHub: () => void;
    onNewHero: () => void;
    onResumePlaying: (newSessionId: number) => void;
}) {
    const { toast } = useToast();
    const [busy, setBusy] = useState<string | null>(null);

    const run = useCallback(
        async (label: string, fn: () => Promise<void>) => {
            setBusy(label);
            try {
                await fn();
            } catch (err) {
                toast({
                    variant: 'destructive',
                    description:
                        err instanceof Error ? err.message : 'Não foi possível concluir a ação.',
                });
            } finally {
                setBusy(null);
            }
        },
        [toast],
    );

    const vaultId = payload.vaultTemplateId ?? null;

    return (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-dnd-obsidian/95 p-6 backdrop-blur-sm">
            <div className="max-w-md w-full rounded-2xl border border-dnd-ember/40 bg-dnd-obsidian-raised p-8 text-center shadow-2xl">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-dnd-ember/50 bg-dnd-ember/10">
                    <Skull className="h-8 w-8 text-dnd-ember" aria-hidden />
                </div>
                <h1 className="font-display text-2xl text-dnd-parchment">Você morreu</h1>
                <p className="mt-2 font-narrative text-sm text-dnd-parchment-muted">
                    {payload.heroName} caiu em batalha no nível {payload.level}.
                    {payload.reason ? ` ${payload.reason}` : ''}
                </p>
                <p className="mt-4 font-ui text-xs text-dnd-parchment-muted">
                    A campanha desta sessão terminou. Escolha o próximo passo:
                </p>
                <div className="mt-6 flex flex-col gap-2">
                    {vaultId ? (
                        <>
                            <DndButton
                                variant="ember"
                                disabled={busy != null}
                                onClick={() =>
                                    run('save', async () => {
                                        await exportSessionHeroToVault(sessionId);
                                        toast({
                                            description: 'Herói salvo no cofre neste nível.',
                                        });
                                    })
                                }
                            >
                                {busy === 'save' ? 'Salvando…' : 'Salvar neste nível no cofre'}
                            </DndButton>
                            <DndButton
                                variant="goldOutline"
                                disabled={busy != null}
                                onClick={() =>
                                    run('campaign', async () => {
                                        await exportSessionHeroToVault(sessionId).catch(() => undefined);
                                        const { session } = await createAndLoadPenaiSession(
                                            `Nova aventura de ${payload.heroName}`,
                                            { name: payload.heroName, id: vaultId },
                                            userId,
                                        );
                                        const newId = Number(session.id);
                                        if (!Number.isFinite(newId)) {
                                            throw new Error('Sessão inválida.');
                                        }
                                        onResumePlaying(newId);
                                    })
                                }
                            >
                                {busy === 'campaign' ? 'Abrindo…' : 'Nova campanha (mesmo herói)'}
                            </DndButton>
                            <DndButton
                                variant="goldOutline"
                                disabled={busy != null}
                                onClick={() =>
                                    run('reset', async () => {
                                        await resetVaultHeroProgress(vaultId);
                                        const { session } = await createAndLoadPenaiSession(
                                            `Recomeço de ${payload.heroName}`,
                                            { name: payload.heroName, id: vaultId },
                                            userId,
                                        );
                                        const newId = Number(session.id);
                                        if (!Number.isFinite(newId)) {
                                            throw new Error('Sessão inválida.');
                                        }
                                        onResumePlaying(newId);
                                    })
                                }
                            >
                                {busy === 'reset' ? 'Reiniciando…' : 'Recomeçar do zero (nível 1)'}
                            </DndButton>
                        </>
                    ) : null}
                    <DndButton variant="ghost" disabled={busy != null} onClick={onNewHero}>
                        Criar novo herói
                    </DndButton>
                    <DndButton variant="ghost" disabled={busy != null} onClick={onReturnToHub}>
                        Voltar ao hub
                    </DndButton>
                </div>
            </div>
        </div>
    );
}
