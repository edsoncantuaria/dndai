// backend/src/utils/streamUtils.ts

/**
 * Converte um ReadableStream (como o `body` de uma resposta fetch) em um Buffer.
 * @param stream O ReadableStream a ser convertido.
 * @returns Uma Promise que resolve com o Buffer completo.
 */
export async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}
