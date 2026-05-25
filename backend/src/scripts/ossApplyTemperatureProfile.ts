/**
 * Gera logs/oss-temperature-profile.json a partir do último relatório de benchmark.
 * Uso: npm run ai:oss-apply-temp-profile
 */
import fs from 'fs';
import path from 'path';
import { suggestProfileFromBenchmarkReport } from '../ai-oss/tuning/temperatureProfile.js';

const logsDir = path.join(process.cwd(), 'logs');

const run = () => {
    const files = fs
        .readdirSync(logsDir)
        .filter(f => f.startsWith('oss-quality-benchmark-') && f.endsWith('.json'))
        .map(f => ({ f, mtime: fs.statSync(path.join(logsDir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);

    if (!files.length) {
        console.error('[oss-apply-temp] Nenhum relatório em logs/. Rode: npm run ai:oss-benchmark');
        process.exit(1);
    }

    const latest = path.join(logsDir, files[0].f);
    const report = JSON.parse(fs.readFileSync(latest, 'utf8')) as {
        passRatePercent: number;
        results: Array<{ id: string; ok: boolean }>;
    };

    const profile = suggestProfileFromBenchmarkReport(report);
    const outPath = path.join(logsDir, 'oss-temperature-profile.json');
    fs.writeFileSync(
        outPath,
        JSON.stringify(
            {
                generatedAt: new Date().toISOString(),
                sourceReport: files[0].f,
                passRatePercent: report.passRatePercent,
                profile,
            },
            null,
            2,
        ),
    );

    console.log('[oss-apply-temp] Perfil escrito:', outPath);
    console.log(JSON.stringify(profile, null, 2));
    console.log('[oss-apply-temp] Defina OSS_TEMP_PROFILE_PATH=logs/oss-temperature-profile.json');
};

run();
