import 'dotenv/config';
import { register } from 'tsx/esm/api';

await register({
  tsconfig: new URL('../tsconfig.json', import.meta.url).pathname,
  experimentalTsImport: true,
});

const { AppDataSource } = await import('../src/database/data-source.ts');
const { SessionLog } = await import('../src/entities/SessionLog.ts');

await AppDataSource.initialize();
try {
  const repo = AppDataSource.getRepository(SessionLog);
  const counts = await repo
    .createQueryBuilder('log')
    .select('log.type', 'type')
    .addSelect('COUNT(*)', 'count')
    .groupBy('log.type')
    .orderBy('log.type', 'ASC')
    .getRawMany();
  console.table(counts);
} catch (err) {
  console.error('[checkSessionLogs] failed', err);
  process.exitCode = 1;
} finally {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}
