import type { FastifyInstance } from 'fastify';
import {
    synthesizeNarrationAudio,
    isTtsAvailable,
    buildTtsPlaybackUrl,
    isValidTtsObjectKey,
} from '../../../services/ttsService.js';
import { isPiperVoiceId } from '../../../config/narrationTts.js';
import { fetchObjectBuffer, isObjectStorageEnabled } from '../../../services/objectStorageService.js';

export async function ttsRoutes(app: FastifyInstance): Promise<void> {
    const auth = { preHandler: [app.authenticate] };

    app.post('/api/v2/tts/generate', auth, async (request, reply) => {
        if (!isTtsAvailable()) {
            return reply.status(503).send({ message: 'TTS não está configurado neste servidor.' });
        }
        const body = request.body as Record<string, unknown>;
        const text = typeof body.text === 'string' ? body.text : '';
        if (!text.trim()) {
            return reply.status(400).send({ message: 'Texto inválido para síntese.' });
        }
        const voice = body.voice ?? body.narrationVoice;
        const audio = await synthesizeNarrationAudio(text, {
            voice: isPiperVoiceId(voice) ? voice : undefined,
            lengthScale: typeof body.lengthScale === 'number' ? body.lengthScale : undefined,
            settings: {
                narrationVoice: isPiperVoiceId(body.narrationVoice)
                    ? body.narrationVoice
                    : isPiperVoiceId(body.voice)
                      ? body.voice
                      : undefined,
                narrationSpeed: body.narrationSpeed,
            },
        });
        if (!audio?.key) {
            return reply.status(500).send({ message: 'Falha ao gerar o áudio solicitado.' });
        }
        return reply.status(201).send({
            audioKey: audio.key,
            audioUrl: audio.url ?? buildTtsPlaybackUrl(audio.key),
        });
    });

    app.get('/api/v2/tts/audio', async (request, reply) => {
        if (!isObjectStorageEnabled) {
            return reply.status(503).send({ message: 'Armazenamento de áudio não configurado.' });
        }
        const key = String((request.query as { key?: string }).key ?? '').trim();
        if (!key || !isValidTtsObjectKey(key)) {
            return reply.status(400).send({ message: 'Chave de áudio inválida.' });
        }
        const object = await fetchObjectBuffer(key);
        if (!object) {
            return reply.status(404).send({ message: 'Áudio não encontrado.' });
        }
        return reply
            .header('Content-Type', object.contentType || 'audio/wav')
            .header('Content-Length', String(object.size))
            .header('Cache-Control', 'private, max-age=86400')
            .send(object.buffer);
    });

    app.get('/api/v2/tts/presign', auth, async (request, reply) => {
        const key = String((request.query as { key?: string }).key ?? '').trim();
        if (!key || !isValidTtsObjectKey(key)) {
            return reply.status(400).send({ message: 'Parâmetro "key" inválido.' });
        }
        return { audioUrl: buildTtsPlaybackUrl(key) };
    });
}
