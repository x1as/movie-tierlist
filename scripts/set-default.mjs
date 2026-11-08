// Делает выгрузку тирлистом по умолчанию (тирлист Xias).
// node scripts/set-default.mjs "KT1.…"   или   node scripts/set-default.mjs path/to/tierlist.json
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import { BY_ID } from '../src/data/movies.ts'

const arg = process.argv[2]
if (!arg) throw new Error('Передай код KT1.… или путь к .json')
const text = existsSync(arg) ? readFileSync(arg, 'utf8').trim() : arg.trim()
let raw
if (text.startsWith('{')) raw = JSON.parse(text)
else {
  const b64 = text.match(/KT1\.([A-Za-z0-9_-]+)/)[1].replace(/-/g, '+').replace(/_/g, '/')
  raw = JSON.parse(inflateRawSync(Buffer.from(b64, 'base64')).toString('utf8'))
}
const tiers = { S: [], A: [], B: [], C: [], D: [], X: [] }
const seen = new Set()
let skipped = 0
for (const k of Object.keys(tiers)) for (const id of raw.tiers?.[k] ?? []) {
  if (BY_ID[id] && !seen.has(id)) { seen.add(id); tiers[k].push(id) } else skipped++
}
const snap = { v: 1, name: 'Xias', tiers, at: raw.at ?? new Date().toISOString().slice(0, 10) }
writeFileSync(new URL('../src/data/xias.ts', import.meta.url),
  `// Тирлист Xias по умолчанию. Обновляется: node scripts/set-default.mjs "KT1.…"\nimport type { Snapshot } from '../lib/codec'\n\nexport const XIAS: Snapshot | null = ${JSON.stringify(snap, null, 1)}\n`)
console.log('ok:', Object.entries(tiers).map(([k, v]) => `${k}=${v.length}`).join(' '), skipped ? `(пропущено ${skipped})` : '')
