import { reactive, watch, computed } from 'vue'
import { ALL_TIERS, type TierKey } from '../data/meta'
import { MOVIES } from '../data/movies'
import { XIAS } from '../data/xias'
import { emptyTiers, sanitize, type Snapshot, type Tiers } from './codec'

const KEY = 'lamp-tierlist.v1'

function initial(): { name: string; tiers: Tiers; isXias: boolean } {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw)
      return { ...sanitize(p), isXias: !!p.isXias }
    }
  } catch {}
  if (XIAS) return { name: XIAS.name || 'Xias', tiers: structuredClone(sanitize(XIAS).tiers), isXias: true }
  return { name: '', tiers: emptyTiers(), isXias: false }
}

export const state = reactive(initial())

watch(
  state,
  () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 1, name: state.name, tiers: state.tiers, isXias: state.isXias }))
    } catch {}
  },
  { deep: true },
)

export const placed = computed(() => {
  const m = new Map<string, TierKey>()
  for (const k of ALL_TIERS) for (const id of state.tiers[k]) m.set(id, k)
  return m
})

export const poolIds = computed(() => MOVIES.filter((m) => !placed.value.has(m.id)).map((m) => m.id))

const touched = () => {
  if (state.isXias) {
    state.isXias = false
    if (state.name === (XIAS?.name || 'Xias')) state.name = ''
  }
}

export function move(id: string, to: TierKey | null, index = Infinity) {
  const from = placed.value.get(id)
  if (from) {
    const arr = state.tiers[from]
    arr.splice(arr.indexOf(id), 1)
  }
  if (to) {
    const arr = state.tiers[to]
    arr.splice(Math.min(index, arr.length), 0, id)
  }
  touched()
}

export function clearAll() {
  state.tiers = emptyTiers()
  state.name = ''
  state.isXias = false
}

export function resetToXias() {
  if (!XIAS) return clearAll()
  state.tiers = structuredClone(sanitize(XIAS).tiers)
  state.name = XIAS.name || 'Xias'
  state.isXias = true
}

export function loadSnapshot(s: Snapshot) {
  state.tiers = structuredClone(s.tiers)
  state.name = s.name
  state.isXias = false
}

export const snapshot = (): Snapshot => ({
  v: 1,
  name: state.name || 'Аноним',
  tiers: structuredClone(JSON.parse(JSON.stringify(state.tiers))),
  at: new Date().toISOString().slice(0, 10),
})
