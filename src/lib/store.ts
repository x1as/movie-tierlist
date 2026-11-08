import { reactive, watch, computed, ref } from 'vue'
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

// Сохранение откладываем, чтобы запись не попадала в кадр с перетаскиванием
let saveTimer = 0
const persist = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, name: state.name, tiers: state.tiers, isXias: state.isXias }))
  } catch {}
}
watch(state, () => { clearTimeout(saveTimer); saveTimer = window.setTimeout(persist, 400) }, { deep: true })
window.addEventListener('pagehide', persist)

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

// ── история для «Отменить» (Ctrl+Z) ──
type Step = { id: string; from: TierKey | null; index: number } | { tiers: Tiers; name: string; isXias: boolean }
const history = ref<Step[]>([])
export const canUndo = computed(() => history.value.length > 0)
const remember = (s: Step) => { history.value.push(s); if (history.value.length > 200) history.value.shift() }
const keepAll = () => remember({ tiers: JSON.parse(JSON.stringify(state.tiers)), name: state.name, isXias: state.isXias })

export function move(id: string, to: TierKey | null, index = Infinity, record = true) {
  const from = placed.value.get(id) ?? null
  let fromIndex = Infinity
  if (from) {
    const arr = state.tiers[from]
    fromIndex = arr.indexOf(id)
    arr.splice(fromIndex, 1)
  }
  if (to) {
    const arr = state.tiers[to]
    arr.splice(Math.min(index, arr.length), 0, id)
  }
  if (record && (from !== to || fromIndex !== index)) remember({ id, from, index: fromIndex })
  touched()
}

export function undo() {
  const s = history.value.pop()
  if (!s) return
  if ('id' in s) move(s.id, s.from, s.index, false)
  else { state.tiers = s.tiers; state.name = s.name; state.isXias = s.isXias }
}

export function clearAll() {
  keepAll()
  state.tiers = emptyTiers()
  state.name = ''
  state.isXias = false
}

export function resetToXias() {
  if (!XIAS) return clearAll()
  keepAll()
  state.tiers = structuredClone(sanitize(XIAS).tiers)
  state.name = XIAS.name || 'Xias'
  state.isXias = true
}

export function loadSnapshot(s: Snapshot) {
  keepAll()
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
