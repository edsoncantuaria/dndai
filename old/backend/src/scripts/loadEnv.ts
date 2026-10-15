/** Carrega .env antes de módulos que leem config/env.ts (imports ESM são hoisted). */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../.env') });
config({ path: resolve(process.cwd(), '.env') });
