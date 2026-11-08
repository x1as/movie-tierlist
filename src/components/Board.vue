<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import TierRow from './TierRow.vue'
import PoolGrid from './PoolGrid.vue'
import QuickRate from './QuickRate.vue'
import ScrollArea from './ScrollArea.vue'
import { ALL_TIERS, GENRES, KINDS, type TierKey } from '../data/meta'
import { BY_ID, MOVIES, type Kind } from '../data/movies'
import { move, placed, poolIds, state, undo, canUndo } from '../lib/store'
import { justDropped } from '../lib/dnd'

const emit = defineEmits<{ open: [id: string] }>()

// ── сохранённые настройки вида ──
const pref = (k: string, d: number) => { try { const v = Number(localStorage.getItem('lt.' + k)); return v || d } catch { return d } }
const save = (k: string, v: number) => { try { localStorage.setItem('lt.' + k, String(v)) } catch {} }
const poolW = ref(pref('poolW', 540))
const cols = ref(pref('cols', 4))
watch(poolW, (v) => save('poolW', v))
watch(cols, (v) => save('cols', v))

// ── тиры всегда влезают в экран ──
// Ищем самый крупный общий размер постера, при котором все ряды помещаются по высоте.
// В каждом ряду держим запас на одну карточку: входящая карточка никогда не вылезет за край,
// а пустой ряд всегда не ниже одного постера.
const tiersBox = ref<HTMLElement | null>(null)
const box = reactive({ w: 0, h: 0 })
const wide = ref(true)
let boxRO: ResizeObserver | null = null
const GAP = 6, ROW_GAP = 10, ROW_PAD = 16, LABEL = 78, LABEL_GAP = 10, MAX_W = 118, MIN_W = 22
const rowsFor = (n: number, w: number, inner: number) => Math.ceil(n / Math.max(1, Math.floor((inner + GAP) / (w + GAP))))
const fit = computed(() => {
  const inner = box.w - LABEL - LABEL_GAP - ROW_PAD
  const avail = box.h - ROW_GAP * (ALL_TIERS.length - 1)
  const counts = ALL_TIERS.map((k) => state.tiers[k].length + 1) // +1 — место под входящую карточку
  const need = (w: number) => counts.map((n) => { const r = rowsFor(n, w, inner); return r * w * 1.5 + (r - 1) * GAP + ROW_PAD })
  let w = MAX_W
  if (inner > 0 && avail > 0) for (; w > MIN_W; w--) if (need(w).reduce((a, b) => a + b, 0) <= avail) break
  return { w, heights: need(w) }
})
// стили пишем прямо в DOM: без перерисовки компонентов и без пересчёта стилей каталога
watch([fit, wide, tiersBox], () => {
  const el = tiersBox.value
  if (!el) return
  if (!wide.value || box.w < 200 || box.h < 200) { el.removeAttribute('style'); return }
  el.style.setProperty('--card-w', fit.value.w + 'px')
  ALL_TIERS.forEach((k, i) => el.style.setProperty('--basis-' + k, fit.value.heights[i] + 'px'))
}, { flush: 'sync' })
const mq = matchMedia('(min-width: 901px)')
const onMq = () => (wide.value = mq.matches)
// замер синхронно (и на resize окна) — не зависим только от ResizeObserver
const measureBox = () => { wide.value = mq.matches; const el = tiersBox.value; if (el) { box.w = el.clientWidth; box.h = el.clientHeight } }
onMounted(() => {
  onMq()
  mq.addEventListener('change', onMq)
  measureBox()
  requestAnimationFrame(measureBox)
  window.addEventListener('resize', measureBox)
  boxRO = new ResizeObserver(([e]) => { box.w = e.contentRect.width; box.h = e.contentRect.height })
  if (tiersBox.value) boxRO.observe(tiersBox.value)
})
onBeforeUnmount(() => { boxRO?.disconnect(); mq.removeEventListener('change', onMq); window.removeEventListener('resize', measureBox) })

// ── фильтры каталога ──
const q = ref('')
const kind = ref<Kind | ''>('')
const genre = ref('')
const source = ref<'all' | 'mine' | 'recs'>('all')
const pool = computed(() => {
  const s = q.value.trim().toLowerCase()
  return poolIds.value.filter((id) => {
    const m = BY_ID[id]
    if (kind.value && m.kind !== kind.value) return false
    if (genre.value && !m.genres.includes(genre.value)) return false
    if (source.value === 'mine' && !m.mine) return false
    if (source.value === 'recs' && m.mine) return false
    if (s && !m.title.toLowerCase().includes(s) && !m.wiki.toLowerCase().includes(s) && String(m.year) !== s) return false
    return true
  })
})
const total = computed(() => placed.value.size)

function onClick(ev: MouseEvent) {
  if (justDropped()) return
  const el = (ev.target as HTMLElement).closest('.poster') as HTMLElement | null
  if (el?.dataset.id) emit('open', el.dataset.id)
}

// ── ресайз каталога ──
const boardEl = ref<HTMLElement | null>(null)
const resizing = ref(false)
function startResize(e: PointerEvent) {
  e.preventDefault()
  const handle = e.currentTarget as HTMLElement
  handle.setPointerCapture(e.pointerId)
  resizing.value = true
  const right = boardEl.value!.getBoundingClientRect().right
  const max = () => Math.min(window.innerWidth * 0.72, window.innerWidth - 420)
  const onMove = (ev: PointerEvent) => { poolW.value = Math.round(Math.max(320, Math.min(max(), right - ev.clientX))) }
  const onUp = () => {
    resizing.value = false
    handle.removeEventListener('pointermove', onMove)
    handle.removeEventListener('pointerup', onUp)
  }
  handle.addEventListener('pointermove', onMove)
  handle.addEventListener('pointerup', onUp)
}
function nudge(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') poolW.value = Math.min(window.innerWidth * 0.72, poolW.value + 24)
  if (e.key === 'ArrowRight') poolW.value = Math.max(320, poolW.value - 24)
}

// ── горячие клавиши: наведи и нажми S/A/B/C/D или 1–5; X / 0 — обратно в каталог ──
let hovered: string | null = null
function onOver(ev: MouseEvent) {
  const el = (ev.target as HTMLElement).closest('.poster') as HTMLElement | null
  hovered = el?.dataset.id ?? null
}
const KEYMAP: Record<string, TierKey | null> = {
  s: 'S', a: 'A', b: 'B', c: 'C', d: 'D',
  ы: 'S', ф: 'A', и: 'B', с: 'C', в: 'D',
  '1': 'S', '2': 'A', '3': 'B', '4': 'C', '5': 'D', x: null, ч: null, '0': null, backspace: null,
}
function onKey(e: KeyboardEvent) {
  if (quick.value) return
  const inField = !!(e.target as HTMLElement)?.closest?.('input, textarea, select')
  if ((e.ctrlKey || e.metaKey) && ['z', 'я'].includes(e.key.toLowerCase()) && !inField) {
    e.preventDefault()
    return undo()
  }
  if (!hovered || e.ctrlKey || e.metaKey || e.altKey || inField) return
  const k = e.key.toLowerCase()
  if (!(k in KEYMAP)) return
  e.preventDefault()
  const t = KEYMAP[k]
  if ((placed.value.get(hovered) ?? null) === t) return
  move(hovered, t)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// ── карточки ──
const quick = ref<string[] | null>(null)
const startQuick = () => { if (pool.value.length) quick.value = [...pool.value] }

// ── тирлист картинкой ──
const capture = ref<HTMLElement | null>(null)
const shooting = ref(false)
async function saveImage() {
  if (!capture.value || shooting.value) return
  shooting.value = true
  try {
    const el = capture.value
    el.classList.add('shot')
    const imgs = [...el.querySelectorAll('img')]
    await Promise.race([Promise.all(imgs.map((i) => i.decode().catch(() => {}))), new Promise((r) => setTimeout(r, 4000))])
    const { toPng } = await import('html-to-image')
    const url = await toPng(el, {
      pixelRatio: 2,
      backgroundColor: '#0b0716',
      filter: (n) => !(n instanceof HTMLElement && n.dataset.noshot !== undefined),
    })
    const a = document.createElement('a')
    a.href = url
    a.download = `kinotir-${(state.name || 'my').replace(/[^\p{L}\p{N}_-]+/gu, '_')}.png`
    a.click()
  } catch (e) {
    alert('Не получилось сохранить картинку: ' + (e as Error).message)
  } finally {
    capture.value?.classList.remove('shot')
    shooting.value = false
  }
}
</script>


<template>
  <section
    ref="boardEl"
    class="board"
    :class="{ resizing }"
    :style="{ '--pool-w': poolW + 'px', '--cols': cols }"
    @click="onClick"
    @mouseover="onOver"
    @mouseleave="hovered = null"
  >
    <div class="left">
      <div class="toolbar">
        <input v-model="state.name" class="name" maxlength="40" placeholder="Чей тирлист?" />
        <span v-if="state.isXias" class="pill">тирлист Xias · подвинь постер — станет твоим</span>
        <div class="tools">
          <button class="btn deck-btn" :disabled="!pool.length" @click="startQuick">
            <svg viewBox="0 0 24 24"><rect x="8" y="3" width="11" height="15" rx="2.5" transform="rotate(12 13.5 10.5)" /><rect x="4" y="5.5" width="11" height="15" rx="2.5" /></svg>
            Карточки <small>{{ pool.length }}</small>
          </button>
          <span class="icon-btn help" tabindex="0" aria-label="Подсказка">?<span class="tip">Тащи постеры или жми на них. Быстрее: наведи и нажми <kbd>S</kbd><kbd>A</kbd><kbd>B</kbd><kbd>C</kbd><kbd>D</kbd>, <kbd>X</kbd> — обратно в каталог, <kbd>Ctrl Z</kbd> — отменить.</span></span>
          <button class="icon-btn" :disabled="!canUndo" title="Отменить (Ctrl+Z)" aria-label="Отменить" @click="undo">
            <svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
          </button>
          <button class="icon-btn" :disabled="shooting || !total" title="Сохранить картинкой" aria-label="Сохранить картинкой" @click="saveImage">
            <svg v-if="!shooting" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>
            <span v-else class="spin" />
          </button>
        </div>
      </div>

      <div ref="tiersBox" class="tiers-box">
        <div ref="capture" class="capture">
          <div class="shot-title">
            <b>{{ state.name ? `Тирлист: ${state.name}` : 'Мой тирлист' }}</b>
            <span>КИНОТИР · x1as.github.io/movie-tierlist</span>
          </div>
          <TierRow v-for="k in ALL_TIERS" :key="k" :k="k" :ids="state.tiers[k]" />
        </div>
      </div>
    </div>

    <div
      class="resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="Ширина каталога"
      tabindex="0"
      title="Потяни, чтобы изменить ширину · двойной клик — сброс"
      @pointerdown="startResize"
      @dblclick="poolW = 540"
      @keydown="nudge"
    ><i /></div>

    <aside class="pool">
      <div class="pool-head">
        <div class="pool-title">
          <div>
            <h2>Каталог</h2>
            <p>не смотрел или ещё не оценил · <b>{{ poolIds.length }}</b> из {{ MOVIES.length }}</p>
          </div>
          <div class="cols" role="group" aria-label="Карточек в строке">
            <button v-for="n in [3, 4, 5, 6]" :key="n" :class="{ on: cols === n }" :title="`${n} в строке`" @click="cols = n">{{ n }}</button>
          </div>
        </div>
        <label class="search">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          <input v-model="q" type="search" placeholder="Фильм, сериал или год" />
        </label>
        <div class="chips">
          <button :class="{ on: source === 'all' }" @click="source = 'all'">Все</button>
          <button :class="{ on: source === 'mine' }" @click="source = 'mine'">Из списка Xias</button>
          <button :class="{ on: source === 'recs' }" @click="source = 'recs'">Рекомендации</button>
          <select v-model="kind" :class="{ on: kind }">
            <option value="">Формат</option>
            <option v-for="(l, k) in KINDS" :key="k" :value="k">{{ l }}</option>
          </select>
          <select v-model="genre" :class="{ on: genre }">
            <option value="">Жанр</option>
            <option v-for="(l, k) in GENRES" :key="k" :value="k">{{ l }}</option>
          </select>
        </div>
      </div>
      <ScrollArea class="pool-scroll">
        <PoolGrid :ids="pool" />
        <p v-if="!pool.length" class="empty">{{ poolIds.length ? 'Под фильтр ничего не подходит' : 'Каталог пуст — всё разложено' }}</p>
      </ScrollArea>
    </aside>
    <Teleport to="body"><QuickRate v-if="quick" :ids="quick" @close="quick = null" /></Teleport>
  </section>
</template>

<style scoped>
.board {
  height: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 16px var(--pool-w);
  min-height: 0;
}
.left { display: flex; flex-direction: column; min-width: 0; min-height: 0; }

/* ── панель над тирами ── */
.toolbar { display: flex; align-items: center; gap: 10px; padding: 0 2px 12px; min-width: 0; }
.name {
  flex: 1 1 160px; min-width: 0;
  background: transparent; border: 0; padding: 2px 0;
  font: 800 30px/1.1 var(--font-body); letter-spacing: -0.03em;
  background-image: var(--grad);
  -webkit-background-clip: text; background-clip: text;
  color: transparent;
  caret-color: var(--accent);
}
.name:focus { outline: none; }
.name::placeholder { color: var(--muted); -webkit-text-fill-color: var(--muted); }
.pill { font: 600 12px var(--font-body); color: var(--text); background: var(--accent-soft); box-shadow: inset 0 0 0 1px rgba(255, 43, 214, 0.35); padding: 6px 12px; border-radius: 99px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.tools { display: flex; gap: 8px; align-items: center; flex: none; }
.deck-btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; }
.deck-btn small { font: 700 11.5px var(--font-body); background: rgba(0, 0, 0, 0.22); border-radius: 99px; padding: 2px 8px; font-variant-numeric: tabular-nums; }
.icon-btn {
  width: 40px; height: 40px; border-radius: 14px;
  display: grid; place-items: center;
  background: var(--surface-2); border: 0; color: var(--text);
  box-shadow: inset 0 0 0 1px var(--line);
  cursor: pointer; transition: background 0.15s, transform 0.1s;
}
.icon-btn:hover:not(:disabled) { background: var(--surface-3); }
.icon-btn:active:not(:disabled) { transform: scale(0.94); }
.icon-btn:disabled { opacity: 0.35; cursor: default; }
.icon-btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--line-2); border-top-color: var(--accent); animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── тиры: неоновые объёмные плитки, всегда влезают без скролла ── */
.tiers-box { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding-right: 2px; }
.capture { display: flex; flex-direction: column; gap: 10px; min-height: 100%; }
.hint { color: var(--muted); font: 500 12.5px/2.1 var(--font-body); margin: 12px 4px 6px; }
kbd {
  font: 700 11px/1 var(--font-body);
  padding: 4px 7px; margin: 0 2px; border-radius: 7px;
  background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line-2), 0 2px 0 rgba(255, 255, 255, 0.06);
  color: var(--text);
}

/* ── ресайзер ── */
.resizer { cursor: col-resize; position: relative; touch-action: none; display: grid; place-items: center; }
.resizer i { width: 4px; height: 48px; border-radius: 99px; background: var(--line-2); transition: height 0.2s, background 0.2s, box-shadow 0.2s; }
.resizer:hover i, .resizing .resizer i, .resizer:focus-visible i { height: 110px; background: var(--grad); box-shadow: 0 0 14px var(--accent); }
.resizer:focus-visible { outline: none; }
.resizing, .resizing * { cursor: col-resize !important; user-select: none; }

/* ── каталог ── */
.pool {
  min-width: 0; min-height: 0;
  background: var(--surface);
  border-radius: 24px;
  box-shadow: inset 0 0 0 1px var(--line), 0 24px 60px -30px rgba(0, 0, 0, 0.95);
  display: flex; flex-direction: column;
  overflow: hidden;
}
.pool-head { padding: 16px 16px 12px; display: flex; flex-direction: column; gap: 12px; }
.pool-title { display: flex; align-items: flex-start; gap: 12px; }
.pool-title h2 { margin: 0; font: 800 24px/1.05 var(--font-body); letter-spacing: -0.03em; }
.pool-title p { margin: 4px 0 0; font-size: 12.5px; color: var(--muted); }
.pool-title p b { color: var(--text); font-variant-numeric: tabular-nums; }
.cols { margin-left: auto; display: flex; padding: 3px; gap: 2px; border-radius: 12px; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line); }
.cols button { width: 30px; height: 28px; border: 0; border-radius: 9px; background: transparent; color: var(--text-2); font: 700 12.5px var(--font-body); cursor: pointer; }
.cols button:hover { color: var(--text); }
.cols button.on { background: var(--text); color: var(--on-tier); }
.help { position: relative; font: 800 15px var(--font-body); cursor: help; }
.help .tip {
  position: absolute; top: calc(100% + 10px); right: 0; z-index: 40; width: 300px;
  padding: 12px 14px; border-radius: 16px;
  background: var(--surface-solid); box-shadow: var(--shadow-lg);
  font: 500 13px/1.9 var(--font-body); color: var(--text-2); text-align: left;
  opacity: 0; transform: translateY(-4px); pointer-events: none; transition: opacity 0.15s, transform 0.15s;
}
.help:hover .tip, .help:focus .tip { opacity: 1; transform: none; }
.search {
  display: flex; align-items: center; gap: 8px;
  height: 44px; padding: 0 14px;
  border-radius: 99px;
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px var(--line);
  transition: box-shadow 0.15s, background 0.15s;
}
.search:focus-within { background: var(--surface-3); box-shadow: inset 0 0 0 1.5px var(--accent), 0 0 24px -6px var(--accent-glow); }
.search svg { width: 18px; height: 18px; flex: none; fill: none; stroke: var(--muted); stroke-width: 2; stroke-linecap: round; }
.search input { flex: 1; min-width: 0; background: transparent; border: 0; outline: none; font: 500 14.5px var(--font-body); color: var(--text); }
.search input::placeholder { color: var(--muted); }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chips button, .chips select {
  height: 34px; border: 0; background: var(--surface-2); color: var(--text-2);
  box-shadow: inset 0 0 0 1px var(--line);
  border-radius: 99px; padding: 0 14px; font: 600 13px var(--font-body); cursor: pointer;
  transition: background 0.15s, color 0.15s, box-shadow 0.15s;
}
.chips select { padding: 0 10px 0 14px; max-width: 170px; appearance: auto; }
.chips select option { background: var(--surface-solid); color: var(--text); }
.chips button:hover, .chips select:hover { background: var(--surface-3); color: var(--text); }
.chips .on { background: var(--text); color: var(--on-tier); box-shadow: none; }
.chips .on:hover { background: var(--text); color: var(--on-tier); }
.pool-scroll { flex: 1; min-height: 0; }
.empty { color: var(--muted); text-align: center; padding: 10px 16px 24px; margin: 0; }

/* ── картинка ── */
.shot-title { display: none; }
.capture.shot { height: auto; padding: 26px; width: 1200px; background: radial-gradient(900px 500px at 0% 0%, rgba(255, 43, 214, 0.22), transparent 70%), radial-gradient(900px 600px at 100% 100%, rgba(34, 228, 255, 0.18), transparent 70%), #0b0716; }
.capture.shot .shot-title { display: flex; justify-content: space-between; align-items: baseline; gap: 20px; padding: 0 4px 10px; }
.shot-title b { font: 800 34px var(--font-body); letter-spacing: -0.03em; white-space: nowrap; }
.shot-title span { font: 700 13px var(--font-display); color: var(--muted); white-space: nowrap; }
.capture.shot :deep(.tier) { background: rgba(255, 255, 255, 0.05); }

@media (max-width: 900px) {
  .board { height: auto; grid-template-columns: 1fr; gap: 14px; --card-w: 58px !important; --cols: 4 !important; }
  .resizer { display: none; }
  .tiers-box { overflow: visible; }
  .capture { height: auto; }
  .pool-scroll { max-height: 70vh; }
  .cols { display: none; }
  .toolbar { flex-wrap: wrap; }
  .pill { order: 3; }
}
@media (max-width: 560px) {
  .board { --card-w: 50px !important; --cols: 3 !important; }
  .tools { width: 100%; }
  .deck-btn { flex: 1; }
  .name { font-size: 24px; }
}
</style>
