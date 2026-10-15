import { importSrd, SRD_DB } from "../src/srd/import.ts"
const r = importSrd()
console.log(`srd.db: ${r.records} registros, ${r.refs} referências, ${r.ptBR} traduções pt-BR → ${SRD_DB}`)
for (const [c, n] of Object.entries(r.perCollection)) console.log(`  ${c.padEnd(28)} ${n}`)
