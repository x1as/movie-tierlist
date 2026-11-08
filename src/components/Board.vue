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
const GAP = 6, ROW_GAP = 1, ROW_PAD = 12, LABEL = 56, LABEL_GAP = 8, MAX_W = 118, MIN_W = 22
const rowsFor = (n: number, w: number, inner: number) => Math.ceil(n / Math.max(1, Math.floor((inner + GAP) / (w + GAP))))
const fit = computed(() => {
  const inner = box.w - LABEL - LABEL_GAP - 10
  const avail = box.h - 2 - ROW_GAP * (ALL_TIERS.length - 1)
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
        <div class="title">
          <input v-model="state.name" class="name" maxlength="40" placeholder="Мой тирлист" aria-label="Название тирлиста" />
          <span class="sub">{{ total ? `оценено ${total}` : 'перетащи фильм из каталога' }}<template v-if="state.isXias"> · это тирлист Xias</template></span>
        </div>
        <div class="tools">
          <button class="cta" :disabled="!pool.length" title="Раскладывать по одной карточке" @click="startQuick">
            <svg viewBox="0 0 24 24"><rect x="8" y="3" width="11" height="15" rx="2.5" transform="rotate(12 13.5 10.5)" /><rect x="4" y="5.5" width="11" height="15" rx="2.5" /></svg>
            Карточки
          </button>
          <div class="group">
            <button :disabled="!canUndo" title="Отменить · Ctrl+Z" aria-label="Отменить" @click="undo">
              <svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
            </button>
            <button :disabled="shooting || !total" title="Сохранить картинкой" aria-label="Сохранить картинкой" @click="saveImage">
              <svg v-if="!shooting" viewBox="0 0 24 24"><path d="M12 15V3" /><path d="m7 10 5 5 5-5" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
              <span v-else class="spin" />
            </button>
            <span class="help" tabindex="0" aria-label="Подсказка">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6" /><path d="M12 17.2h.01" /></svg>
              <span class="tip">Перетаскивай постеры или нажимай на них. Быстрее: наведи и нажми <kbd>S</kbd><kbd>A</kbd><kbd>B</kbd><kbd>C</kbd><kbd>D</kbd>. <kbd>X</kbd> вернёт в каталог, <kbd>Ctrl Z</kbd> отменит.</span>
            </span>
          </div>
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

/* ── панель над тирами: спокойная, одна строка ── */
.toolbar { display: flex; align-items: center; gap: 12px; padding: 2px 2px 12px 4px; min-width: 0; }
.title { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.name {
  width: 100%; min-width: 0;
  background: transparent; border: 0; padding: 0;
  font: 700 20px/1.2 var(--font-body); letter-spacing: -0.02em; color: var(--text);
  text-overflow: ellipsis;
}
.name::placeholder { color: var(--text); opacity: 1; }
.name:focus { outline: none; }
.name:focus::placeholder { color: var(--muted); }
.sub { font: 500 12.5px var(--font-body); color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tools { display: flex; gap: 8px; align-items: center; flex: none; }
.cta {
  display: inline-flex; align-items: center; gap: 8px;
  height: 38px; padding: 0 16px 0 13px; border: 0; border-radius: 12px;
  background: var(--text); color: var(--on-tier);
  font: 700 13.5px var(--font-body); cursor: pointer;
  transition: transform 0.12s, box-shadow 0.2s, opacity 0.15s;
}
.cta svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 2; }
.cta:hover:not(:disabled) { box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.12), 0 8px 24px -10px rgba(255, 255, 255, 0.5); }
.cta:active:not(:disabled) { transform: scale(0.97); }
.cta:disabled { opacity: 0.35; cursor: default; }
.group { display: flex; padding: 3px; gap: 2px; border-radius: 13px; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line); }
.group > button, .group > .help {
  width: 32px; height: 32px; border: 0; border-radius: 10px;
  display: grid; place-items: center;
  background: transparent; color: var(--text-2); cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.group > button:hover:not(:disabled), .group > .help:hover { background: var(--surface-3); color: var(--text); }
.group > button:disabled { opacity: 0.3; cursor: default; }
.group svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.spin { width: 15px; height: 15px; border-radius: 50%; border: 2px solid var(--line-2); border-top-color: var(--text); animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.help { position: relative; cursor: help; }
.help .tip {
  position: absolute; top: calc(100% + 10px); right: -3px; z-index: 40; width: 290px;
  padding: 12px 14px; border-radius: 14px;
  background: var(--surface-solid); box-shadow: var(--shadow-lg);
  font: 500 13px/1.85 var(--font-body); color: var(--text-2); text-align: left;
  opacity: 0; transform: translateY(-4px); pointer-events: none; transition: opacity 0.15s, transform 0.15s;
}
.help:hover .tip, .help:focus .tip { opacity: 1; transform: none; }

/* ── тиры: неоновые объёмные плитки, всегда влезают без скролла ── */
.tiers-box { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding-right: 2px; }
.capture {
  display: flex; flex-direction: column; gap: 0; min-height: 100%;
  background: var(--surface);
  border-radius: 20px;
  box-shadow: inset 0 0 0 1px var(--line), 0 24px 60px -30px rgba(0, 0, 0, 0.95);
  overflow: hidden;
}
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
.capture.shot { height: auto; padding: 22px 22px 8px; width: 1200px; border-radius: 0; background: radial-gradient(900px 500px at 0% 0%, rgba(255, 43, 214, 0.22), transparent 70%), radial-gradient(900px 600px at 100% 100%, rgba(34, 228, 255, 0.18), transparent 70%), #0b0716; }
.capture.shot .shot-title { display: flex; justify-content: space-between; align-items: baseline; gap: 20px; padding: 0 4px 10px; }
.shot-title b { font: 800 34px var(--font-body); letter-spacing: -0.03em; white-space: nowrap; }
.shot-title span { font: 700 13px var(--font-display); color: var(--muted); white-space: nowrap; }


@media (max-width: 900px) {
  .board { height: auto; grid-template-columns: 1fr; gap: 14px; --card-w: 58px !important; --cols: 4 !important; }
  .resizer { display: none; }
  .tiers-box { overflow: visible; }
  .capture { height: auto; }
  .pool-scroll { max-height: 70vh; }
  .cols { display: none; }
  .toolbar { flex-wrap: wrap; }
  }
@media (max-width: 560px) {
  .board { --card-w: 50px !important; --cols: 3 !important; }
  .tools { width: 100%; }
  .cta { flex: 1; justify-content: center; }
  .name { font-size: 18px; }
}
</style>
