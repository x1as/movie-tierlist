<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Sortable from 'sortablejs'
import Poster from './Poster.vue'
import QuickRate from './QuickRate.vue'
import { ALL_TIERS, GENRES, KINDS, TIERS, type TierKey } from '../data/meta'
import { BY_ID, MOVIES, type Kind } from '../data/movies'
import { move, placed, poolIds, state, undo, canUndo } from '../lib/store'

const emit = defineEmits<{ open: [id: string] }>()

// ── сохранённые настройки вида ──
const pref = (k: string, d: number) => { try { const v = Number(localStorage.getItem('lt.' + k)); return v || d } catch { return d } }
const save = (k: string, v: number) => { try { localStorage.setItem('lt.' + k, String(v)) } catch {} }
const poolW = ref(pref('poolW', 520))
const cardW = ref(pref('cardW', 78))
watch(poolW, (v) => save('poolW', v))
watch(cardW, (v) => save('cardW', v))

// ── фильтры коробки ──
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

// ── drag & drop ──
// forceFallback: свой «призрак» вместо нативного HTML5 DnD — без системной анимации возврата
// и залипания на отпускании. Sortable двигает DOM, мы откатываем и меняем state, Vue перерисовывает.
const lists: HTMLElement[] = []
const addList = (el: unknown) => { if (el && !lists.includes(el as HTMLElement)) lists.push(el as HTMLElement) }
const sortables: Sortable[] = []
const dragging = ref(false)
let next: Node | null = null
let lastDrag = 0

onMounted(() => {
  for (const el of lists) {
    const isPool = el.dataset.list === 'pool'
    sortables.push(
      Sortable.create(el, {
        group: 'tiers',
        sort: !isPool,
        animation: 120,
        easing: 'cubic-bezier(.2,.8,.2,1)',
        draggable: '.poster',
        forceFallback: true,
        fallbackOnBody: true,
        fallbackTolerance: 4,
        delay: 140,
        delayOnTouchOnly: true,
        scroll: true,
        bubbleScroll: true,
        scrollSensitivity: 90,
        scrollSpeed: 14,
        ghostClass: 'drag-ghost',
        chosenClass: 'drag-chosen',
        fallbackClass: 'drag-float',
        onStart: (e) => { next = e.item.nextSibling; dragging.value = true; document.body.classList.add('is-dragging') },
        onEnd: (e) => {
          dragging.value = false
          document.body.classList.remove('is-dragging')
          lastDrag = Date.now()
          const id = e.item.dataset.id!
          const to = (e.to as HTMLElement).dataset.list!
          const from = (e.from as HTMLElement).dataset.list!
          const idx = e.newDraggableIndex ?? e.newIndex ?? 0
          if (to === from && e.oldDraggableIndex === idx) return
          e.item.remove()
          e.from.insertBefore(e.item, next)
          if (to === 'pool') { if (from !== 'pool') move(id, null) }
          else move(id, to as TierKey, idx)
        },
      }),
    )
  }
})
onBeforeUnmount(() => sortables.forEach((s) => s.destroy()))

function onClick(ev: MouseEvent) {
  if (Date.now() - lastDrag < 250) return
  const el = (ev.target as HTMLElement).closest('.poster') as HTMLElement | null
  if (el?.dataset.id) emit('open', el.dataset.id)
}

// ── ресайз коробки ──
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

// ── горячие клавиши: навёл и нажал S/A/B/C/D/X или 1–6, 0 — в коробку, Ctrl+Z — отмена ──
const hovered = ref<string | null>(null)
function onOver(ev: MouseEvent) {
  const el = (ev.target as HTMLElement).closest('.poster') as HTMLElement | null
  hovered.value = el?.dataset.id ?? null
}
const KEYMAP: Record<string, TierKey | null> = {
  s: 'S', a: 'A', b: 'B', c: 'C', d: 'D', x: 'X',
  ы: 'S', ф: 'A', и: 'B', с: 'C', в: 'D', ч: 'X',
  '1': 'S', '2': 'A', '3': 'B', '4': 'C', '5': 'D', '6': 'X', '0': null, backspace: null,
}
function onKey(e: KeyboardEvent) {
  if (quick.value) return
  const inField = !!(e.target as HTMLElement)?.closest?.('input, textarea, select')
  if ((e.ctrlKey || e.metaKey) && ['z', 'я'].includes(e.key.toLowerCase()) && !inField) {
    e.preventDefault()
    return undo()
  }
  if (!hovered.value || e.ctrlKey || e.metaKey || e.altKey || inField) return
  const k = e.key.toLowerCase()
  if (!(k in KEYMAP)) return
  e.preventDefault()
  const id = hovered.value
  const t = KEYMAP[k]
  if (placed.value.get(id) === t) return
  move(id, t)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// ── быстрая раскладка ──
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
    imgs.forEach((i) => (i.loading = 'eager'))
    await Promise.race([Promise.all(imgs.map((i) => i.decode().catch(() => {}))), new Promise((r) => setTimeout(r, 4000))])
    const { toPng } = await import('html-to-image')
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#111'
    const url = await toPng(el, {
      pixelRatio: 2,
      backgroundColor: bg,
      filter: (n) => !(n instanceof HTMLElement && n.dataset.noshot !== undefined),
    })
    const a = document.createElement('a')
    a.href = url
    a.download = `tierlist-${(state.name || 'my').replace(/[^\p{L}\p{N}_-]+/gu, '_')}.png`
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
    :class="{ dragging, resizing }"
    :style="{ '--pool-w': poolW + 'px', '--card-w': cardW + 'px' }"
    @click="onClick"
    @mouseover="onOver"
    @mouseleave="hovered = null"
  >
    <div class="left">
      <div class="toolbar">
        <input v-model="state.name" class="name" maxlength="40" placeholder="Чей это тирлист?" />
        <span v-if="state.isXias" class="pill">тирлист Xias · подвинь постер, и он станет твоим</span>
        <div class="tools">
          <button class="btn quick-btn" :disabled="!pool.length" @click="startQuick">
            Быстрая раскладка <small>{{ pool.length }}</small>
          </button>
          <button class="icon-btn" :disabled="!canUndo" title="Отменить (Ctrl+Z)" aria-label="Отменить" @click="undo">
            <svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
          </button>
          <button class="icon-btn" :disabled="shooting || !total" title="Сохранить картинкой" aria-label="Сохранить картинкой" @click="saveImage">
            <svg v-if="!shooting" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>
            <span v-else class="spin" />
          </button>
        </div>
      </div>

      <div class="tiers-scroll scroll">
        <div ref="capture" class="capture">
          <div class="shot-title">
            <b>{{ state.name ? `Тирлист: ${state.name}` : 'Мой тирлист' }}</b>
            <span>x1as.github.io/movie-tierlist</span>
          </div>
          <div v-for="k in ALL_TIERS" :key="k" class="tier" :data-tier="k">
            <div class="tier-label" :title="TIERS[k].note"><b>{{ TIERS[k].label }}</b></div>
            <div :ref="addList" class="tier-drop" :data-list="k">
              <Poster v-for="id in state.tiers[k]" :key="id" :id="id" />
            </div>
          </div>
        </div>
        <p class="hint">
          Тащи постеры или жми на них. Быстрее: наведи и нажми <kbd>S</kbd><kbd>A</kbd><kbd>B</kbd><kbd>C</kbd><kbd>D</kbd>,
          <kbd>X</kbd> не смотрел, <kbd>0</kbd> в коробку, <kbd>Ctrl Z</kbd> отменить.
        </p>
      </div>
    </div>

    <div
      class="resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="Ширина коробки"
      tabindex="0"
      title="Потяни, чтобы изменить ширину · двойной клик — сброс"
      @pointerdown="startResize"
      @dblclick="poolW = 520"
      @keydown="nudge"
    ><i /></div>

    <aside class="pool">
      <div class="pool-head">
        <div class="pool-title">
          <h2>Коробка</h2>
          <span class="counter"><b>{{ poolIds.length }}</b> / {{ MOVIES.length }}</span>
          <label class="size" title="Размер постеров">
            <svg viewBox="0 0 24 24"><rect x="4" y="6" width="6" height="9" rx="1.5" /><rect x="13" y="3" width="8" height="12" rx="1.5" /></svg>
            <input v-model.number="cardW" type="range" min="56" max="128" step="2" aria-label="Размер постеров" />
          </label>
        </div>
        <div class="search-row">
          <input v-model="q" class="search" type="search" placeholder="Найти фильм, сериал, год…" />
        </div>
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
      <div :ref="addList" class="pool-grid scroll" data-list="pool">
        <Poster v-for="id in pool" :key="id" :id="id" />
      </div>
      <p v-if="!pool.length" class="empty">{{ poolIds.length ? 'Под фильтр ничего не подходит' : 'Коробка пуста, всё разложено' }}</p>
    </aside>
    <Teleport to="body"><QuickRate v-if="quick" :ids="quick" @close="quick = null" /></Teleport>
  </section>
</template>

<style scoped>
.board {
  height: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 10px var(--pool-w);
  gap: 0;
  min-height: 0;
}
.left { display: flex; flex-direction: column; min-width: 0; min-height: 0; }

/* ── панель над тирами ── */
.toolbar { display: flex; align-items: center; gap: 10px; padding: 0 4px 10px 2px; min-width: 0; }
.name {
  flex: 1 1 160px; min-width: 0;
  background: transparent; color: var(--text);
  border: 0; padding: 4px 0;
  font: 600 26px/1.1 var(--font-display); letter-spacing: -0.01em;
}
.name:focus { outline: none; }
.name::placeholder { color: var(--muted); }
.pill { font-size: 12px; font-weight: 600; color: var(--accent); background: var(--accent-soft); padding: 5px 10px; border-radius: 99px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.tools { display: flex; gap: 6px; align-items: center; flex: none; }
.quick-btn small { background: rgba(0, 0, 0, 0.16); border-radius: 99px; padding: 1px 7px; font-size: 12px; font-variant-numeric: tabular-nums; }
.icon-btn {
  width: 38px; height: 38px; border-radius: 11px;
  display: grid; place-items: center;
  background: var(--surface-2); border: 1px solid var(--line); color: var(--text);
  cursor: pointer; transition: background 0.15s, transform 0.1s;
}
.icon-btn:hover:not(:disabled) { background: var(--surface-3); }
.icon-btn:active:not(:disabled) { transform: scale(0.94); }
.icon-btn:disabled { opacity: 0.35; cursor: default; }
.icon-btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--line); border-top-color: var(--accent); animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── тиры ── */
.tiers-scroll { flex: 1; min-height: 0; overflow-y: auto; padding-right: 6px; }
.capture { display: flex; flex-direction: column; gap: 6px; }
.tier {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  background: linear-gradient(90deg, color-mix(in oklab, var(--tc) 10%, var(--surface)), var(--surface) 46%);
  border-radius: 14px;
  overflow: hidden;
  min-height: calc(var(--card-w) * 1.5 + 12px);
  box-shadow: inset 0 0 0 1px var(--line);
  transition: box-shadow 0.15s;
}
.tier-label {
  display: grid; place-items: center;
  background: linear-gradient(165deg, color-mix(in oklab, var(--tc), white 14%), var(--tc) 55%, color-mix(in oklab, var(--tc), black 10%));
  box-shadow: inset -1px 0 0 rgba(0,0,0,.25), 6px 0 24px -10px var(--tc);
  color: var(--on-tier);
}
.tier-label b { font: 700 34px/1 var(--font-display); letter-spacing: -0.02em; text-shadow: 0 1px 0 rgba(255,255,255,.25); }
.tier[data-tier='S'] { --tc: var(--t-s); }
.tier[data-tier='A'] { --tc: var(--t-a); }
.tier[data-tier='B'] { --tc: var(--t-b); }
.tier[data-tier='C'] { --tc: var(--t-c); }
.tier[data-tier='D'] { --tc: var(--t-d); }
.tier[data-tier='X'] { --tc: var(--t-x); }
.tier[data-tier='X'] .tier-label { color: var(--text-2); }
.tier-drop {
  display: flex; flex-wrap: wrap; gap: 5px;
  padding: 6px;
  align-content: flex-start;
  min-height: 100%;
}
.dragging .tier:hover { box-shadow: inset 0 0 0 2px var(--tc); }

.hint { color: var(--muted); font-size: 12.5px; margin: 10px 2px 4px; line-height: 1.9; }
kbd {
  font: 600 11px/1 var(--font-body);
  padding: 3px 6px; margin: 0 2px; border-radius: 5px;
  background: var(--surface-2); border: 1px solid var(--line); border-bottom-width: 2px;
  color: var(--text);
}

/* ── ресайзер ── */
.resizer {
  cursor: col-resize; position: relative; touch-action: none;
  display: grid; place-items: center;
}
.resizer i { width: 3px; height: 44px; border-radius: 3px; background: var(--line); transition: background 0.15s, height 0.15s; }
.resizer:hover i, .resizing .resizer i, .resizer:focus-visible i { background: var(--accent); height: 72px; }
.resizer:focus-visible { outline: none; }
.resizing, .resizing * { cursor: col-resize !important; user-select: none; }

/* ── коробка ── */
.pool {
  min-width: 0; min-height: 0;
  background: var(--surface);
  border-radius: 16px;
  box-shadow: inset 0 0 0 1px var(--line);
  display: flex; flex-direction: column;
  overflow: hidden;
}
.pool-head { padding: 12px 12px 10px; display: flex; flex-direction: column; gap: 8px; border-bottom: 1px solid var(--line); }
.pool-title { display: flex; align-items: center; gap: 10px; }
.pool-title h2 { margin: 0; font: 600 22px/1 var(--font-display); letter-spacing: -0.01em; }
.counter { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
.counter b { color: var(--text); font-weight: 700; }
.size { margin-left: auto; display: flex; align-items: center; gap: 8px; color: var(--muted); }
.size svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; }
.size input { width: 110px; accent-color: var(--accent); }
.search {
  width: 100%;
  background: var(--surface-2); color: var(--text);
  border: 1px solid var(--line); border-radius: 11px;
  padding: 9px 12px; font: 500 14px var(--font-body);
}
.search:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chips button, .chips select {
  border: 1px solid var(--line); background: transparent; color: var(--text-2);
  border-radius: 99px; padding: 5px 11px; font: 600 12.5px var(--font-body); cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.chips select { padding-right: 8px; max-width: 150px; }
.chips select option { background: var(--surface); color: var(--text); }
.chips button:hover, .chips select:hover { border-color: var(--muted); }
.chips .on { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
.pool-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--card-w), 1fr)); grid-auto-rows: max-content; gap: 5px; align-content: start;
  padding: 10px 8px 14px 12px;
  overflow-y: auto;
  flex: 1; min-height: 0;
}
.empty { color: var(--muted); text-align: center; padding: 0 16px 20px; margin: 0; }

.tier-drop :deep(.poster), .pool-grid :deep(.poster) { cursor: grab; }
.pool-grid :deep(.poster) { width: 100%; content-visibility: auto; contain-intrinsic-size: auto var(--card-w) auto calc(var(--card-w) * 1.5); }
.pool-grid, .tier-drop { contain: layout style; }
.board:not(.dragging) .tier-drop :deep(.poster:hover), .board:not(.dragging) .pool-grid :deep(.poster:hover) { transform: translateY(-2px); }

/* ── картинка ── */
.shot-title { display: none; }
.capture.shot { padding: 22px; width: 1200px; background: var(--bg); }
.capture.shot .shot-title { display: flex; justify-content: space-between; align-items: baseline; gap: 20px; padding: 0 4px 8px; }
.shot-title b { font: 600 32px var(--font-display); white-space: nowrap; }
.shot-title span { font: 500 15px var(--font-body); color: var(--muted); white-space: nowrap; }

/* ── узкие экраны: обычная прокрутка, коробка под тирами ── */
@media (max-width: 900px) {
  .board { height: auto; grid-template-columns: 1fr; gap: 12px; --card-w: 58px !important; }
  .resizer { display: none; }
  .tiers-scroll { overflow: visible; padding: 0; }
  .pool-grid { max-height: 64vh; }
  .size { display: none; }
  .toolbar { flex-wrap: wrap; }
  .pill { order: 3; width: 100%; }
}
@media (max-width: 560px) {
  .board { --card-w: 50px !important; }
  .tier { grid-template-columns: 44px minmax(0, 1fr); }
  .tier-label b { font-size: 26px; }
  .tier-drop { gap: 4px; padding: 5px; }
  .tools { width: 100%; }
  .quick-btn { flex: 1; justify-content: center; }
}
</style>
