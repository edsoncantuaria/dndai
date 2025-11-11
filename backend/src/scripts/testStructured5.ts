import path from 'path';
import { createWriteStream, promises as fs } from 'fs';
import { runStructuredFull } from './testStructuredFull.js';

const setupLogTee = async () => {
    const logsDir = path.join(process.cwd(), 'logs');
    await fs.mkdir(logsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logPath = path.join(logsDir, `TESTE-STRUTRADO5_${timestamp}.log`);
    const stream = createWriteStream(logPath, { flags: 'a' });

    const forwardToStream = (chunk: any, encoding?: any) => {
        if (typeof chunk === 'string') {
            stream.write(chunk, encoding as any);
        } else {
            stream.write(chunk);
        }
    };

    const tee = (original: typeof process.stdout.write) =>
        function writeHook(this: typeof process.stdout, chunk: any, encoding?: any, callback?: any) {
            forwardToStream(chunk, encoding);
            return original.call(this, chunk, encoding as any, callback);
        };

    const restoreStdout = process.stdout.write;
    const restoreStderr = process.stderr.write;
    process.stdout.write = tee(process.stdout.write);
    process.stderr.write = tee(process.stderr.write);

    let cleanedUp = false;
    const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        process.stdout.write = restoreStdout;
        process.stderr.write = restoreStderr;
        stream.end();
    };
    process.on('exit', cleanup);
    process.on('SIGINT', () => {
        cleanup();
        process.exit(1);
    });
    console.log(`[structured-output:test5] Log salvo em ${logPath}`);
    return logPath;
};

setupLogTee()
    .then(() => runStructuredFull(process.argv.slice(2)))
    .catch(error => {
        console.error('[structured-output:test5] ❌ Falha ao preparar o log/teste:', error);
        process.exitCode = 1;
    });
