// Формат выгрузки: "KT1." + base64url(deflate-raw(JSON)). Принимает также сырой JSON.
import { ALL_TIERS, type TierKey } from '../data/meta'
import { BY_ID } from '../data/movies'

export type Tiers = Record<TierKey, string[]>
export interface Snapshot {
  v: 1
  name: string
  tiers: Tiers
  at?: string
}

export const emptyTiers = (): Tiers => ({ S: [], A: [], B: [], C: [], D: [], X: [] })

const b64url = (bytes: Uint8Array) => {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const unb64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

export async function encode(snap: Snapshot): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(snap))
  return 'KT1.' + b64url(await pipe(json, new CompressionStream('deflate-raw')))
}

export function sanitize(raw: any): Snapshot {
  const tiers = emptyTiers()
  const seen = new Set<string>()
  const src = raw?.tiers ?? raw?.t ?? {}
  for (const k of ALL_TIERS) {
    for (const id of Array.isArray(src[k]) ? src[k] : []) {
      if (typeof id === 'string' && BY_ID[id] && !seen.has(id)) {
        seen.add(id)
        tiers[k].push(id)
      }
    }
  }
  return { v: 1, name: String(raw?.name ?? raw?.n ?? '').slice(0, 40), tiers, at: raw?.at }
}

export async function decode(input: string): Promise<Snapshot> {
  const text = input.trim()
  if (text.startsWith('{')) return sanitize(JSON.parse(text))
  const m = text.match(/KT1\.([A-Za-z0-9_-]+)/)
  if (!m) throw new Error('Не похоже на код тирлиста')
  const bytes = await pipe(unb64url(m[1]), new DecompressionStream('deflate-raw'))
  return sanitize(JSON.parse(new TextDecoder().decode(bytes)))
}
