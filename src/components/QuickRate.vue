<script setup lang="ts">
// Свайп-колода: карточку тащишь на тир (как в Тиндере), вверх — пропустить.
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ALL_TIERS, GENRES, KINDS, TIERS, type TierKey } from '../data/meta'
import { BY_ID } from '../data/movies'
import { move, placed, poolIds } from '../lib/store'
import { posterUrl } from '../lib/posters'

const props = defineProps<{ ids: string[] }>()
const emit = defineEmits<{ close: [] }>()

// ── очередь и откуда начинать ──
const source = ref<'filter' | 'all' | 'mine' | 'recs'>('filter')
const queue = ref<string[]>([...props.ids])
const pos = ref(0)
function rebuild() {
  const base = source.value === 'filter' ? props.ids : poolIds.value
  queue.value = base.filter((id) => {
    if (placed.value.has(id)) return false
    const m = BY_ID[id]
    if (source.value === 'mine') return m.mine
    if (source.value === 'recs') return !m.mine
    return true
  })
  pos.value = 0
}
const setSource = (s: typeof source.value) => { source.value = s; rebuild() }

const q = ref('')
const found = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (s.length < 2) return []
  return queue.value
    .slice(pos.value)
    .filter((id) => BY_ID[id].title.toLowerCase().includes(s) || BY_ID[id].wiki.toLowerCase().includes(s))
    .slice(0, 6)
})
function startFrom(id: string) {
  const rest = queue.value.slice(pos.value)
  const i = rest.indexOf(id)
  if (i < 0) return
  queue.value = [...queue.value.slice(0, pos.value), ...rest.slice(i), ...rest.slice(0, i)]
  q.value = ''
}

const cur = computed(() => queue.value[pos.value])
const stack = computed(() => queue.value.slice(pos.value + 1, pos.value + 3))
const left = computed(() => queue.value.length - pos.value)
const m = computed(() => (cur.value ? BY_ID[cur.value] : null))
const history: { id: string; tier: TierKey | null }[] = []
const counts = reactive<Record<string, number>>({ S: 0, A: 0, B: 0, C: 0, D: 0, X: 0 })

// ── физика карточки ──
const card = ref<HTMLElement | null>(null)
const pads = ref<Record<string, HTMLElement>>({})
const drag = reactive({ on: false, x: 0, y: 0, sx: 0, sy: 0, t: 0 })
const fly = reactive({ on: false, x: 0, y: 0, s: 1, r: 0, o: 1 })
const target = ref<TierKey | 'skip' | null>(null)
const busy = ref(false)
let pending: TierKey | 'skip' | null = null

const cardStyle = computed(() => {
  if (fly.on) return { transform: `translate(${fly.x}px, ${fly.y}px) rotate(${fly.r}deg) scale(${fly.s})`, opacity: fly.o, transition: 'transform .26s cubic-bezier(.4,.1,.6,1), opacity .26s' }
  const r = drag.x * 0.06
  return { transform: `translate(${drag.x}px, ${drag.y}px) rotate(${r}deg)`, transition: drag.on ? 'none' : 'transform .35s cubic-bezier(.2,1.4,.4,1)' }
})

function padAt(x: number, y: number): TierKey | null {
  for (const k of ALL_TIERS) {
    const r = pads.value[k]?.getBoundingClientRect()
    if (r && x >= r.left - 10 && x <= r.right + 10 && y >= r.top - 30 && y <= r.bottom + 10) return k
  }
  return null
}

function down(e: PointerEvent) {
  if (busy.value || !cur.value) return
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  drag.on = true; drag.sx = e.clientX; drag.sy = e.clientY; drag.t = performance.now()
}
function moveP(e: PointerEvent) {
  if (!drag.on) return
  drag.x = e.clientX - drag.sx
  drag.y = e.clientY - drag.sy
  target.value = padAt(e.clientX, e.clientY) ?? (drag.y < -110 && Math.abs(drag.x) < 140 ? 'skip' : null)
}
function up() {
  if (!drag.on) return
  drag.on = false
  const dt = performance.now() - drag.t
  const vy = drag.y / Math.max(dt, 1)
  const t = target.value ?? (vy < -0.8 ? 'skip' : null)
  target.value = null
  if (t === 'skip') return throwAway()
  if (t) return send(t)
  drag.x = 0; drag.y = 0
}

async function send(t: TierKey) {
  if (busy.value) { pending = t; return }
  if (!cur.value) return
  busy.value = true
  const c = card.value?.getBoundingClientRect()
  const p = pads.value[t]?.getBoundingClientRect()
  if (c && p) {
    const cx = c.left + c.width / 2 - drag.x, cy = c.top + c.height / 2 - drag.y
    Object.assign(fly, { on: true, x: drag.x, y: drag.y, s: 1, r: drag.x * 0.06, o: 1 })
    await nextTick()
    requestAnimationFrame(() => Object.assign(fly, { x: p.left + p.width / 2 - cx, y: p.top + p.height / 2 - cy, s: 0.18, r: (Math.random() - 0.5) * 30, o: 0.2 }))
  }
  const pad = pads.value[t]
  if (pad) { pad.classList.remove('hit'); void pad.offsetWidth; pad.classList.add('hit') }
  setTimeout(() => commit(t), c && p ? 250 : 0)
}
function throwAway() {
  if (busy.value) { pending = 'skip'; return }
  if (!cur.value) return
  busy.value = true
  Object.assign(fly, { on: true, x: drag.x, y: drag.y, s: 1, r: drag.x * 0.06, o: 1 })
  requestAnimationFrame(() => Object.assign(fly, { x: drag.x * 1.4, y: -window.innerHeight * 0.8, s: 0.9, r: drag.x * 0.1, o: 0 }))
  setTimeout(() => commit(null), 240)
}
function commit(t: TierKey | null) {
  const id = cur.value
  if (id && t) { move(id, t); counts[t]++ }
  if (id) history.push({ id, tier: t })
  fly.on = false; drag.x = 0; drag.y = 0
  pos.value++
  busy.value = false
  if (pending) { const n = pending; pending = null; requestAnimationFrame(() => (n === 'skip' ? throwAway() : send(n))) }
}
function back() {
  const last = history.pop()
  if (!last || busy.value) return
  if (last.tier) { move(last.id, null); counts[last.tier]-- }
  pos.value = Math.max(0, pos.value - 1)
  if (queue.value[pos.value] !== last.id) queue.value.splice(pos.value, 0, last.id)
}

// ── клавиатура ──
const KEYS: Record<string, TierKey> = {
  s: 'S', a: 'A', b: 'B', c: 'C', d: 'D', x: 'X',
  ы: 'S', ф: 'A', и: 'B', с: 'C', в: 'D', ч: 'X',
  '1': 'S', '2': 'A', '3': 'B', '4': 'C', '5': 'D', '6': 'X',
}
function onKey(e: KeyboardEvent) {
  if ((e.target as HTMLElement)?.closest?.('input')) { if (e.key === 'Escape') q.value = ''; return }
  if (e.ctrlKey || e.metaKey || e.altKey) return
  const k = e.key.toLowerCase()
  if (k === 'escape') return emit('close')
  if (k === ' ' || k === 'arrowup') { e.preventDefault(); return throwAway() }
  if (k === 'backspace' || k === 'arrowleft') { e.preventDefault(); return back() }
  if (KEYS[k]) { e.preventDefault(); send(KEYS[k]) }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
const placedNow = computed(() => Object.values(counts).reduce((a, b) => a + b, 0))
const setPad = (k: string) => (el: unknown) => { if (el) pads.value[k] = el as HTMLElement }
</script>

<template>
  <div class="deck" role="dialog" aria-label="Раскладка карточками">
    <header class="deck-top">
      <div class="src">
        <button :class="{ on: source === 'filter' }" @click="setSource('filter')">Как в коробке</button>
        <button :class="{ on: source === 'all' }" @click="setSource('all')">Все</button>
        <button :class="{ on: source === 'mine' }" @click="setSource('mine')">Из списка Xias</button>
        <button :class="{ on: source === 'recs' }" @click="setSource('recs')">Рекомендации</button>
      </div>
      <div class="start">
        <input v-model="q" placeholder="Начать с фильма…" aria-label="Начать с фильма" />
        <ul v-if="found.length" class="found">
          <li v-for="id in found" :key="id">
            <button @click="startFrom(id)">
              <img :src="posterUrl(id)" alt="" />
              <span>{{ BY_ID[id].title }} <small>{{ BY_ID[id].year }}</small></span>
            </button>
          </li>
        </ul>
      </div>
      <span class="stat"><b>{{ placedNow }}</b> разложено · <b>{{ left }}</b> осталось</span>
      <button class="close" aria-label="Закрыть" @click="emit('close')">✕</button>
    </header>

    <div class="stage">
      <div v-if="target === 'skip'" class="skip-hint">пропустить ↑</div>
      <div class="pile">
        <div v-for="(id, i) in [...stack].reverse()" :key="id" class="ghost-card" :style="{ '--i': stack.length - i }">
          <img :src="posterUrl(id)" alt="" draggable="false" />
        </div>
        <div
          v-if="m && cur"
          :key="cur"
          ref="card"
          class="card"
          :class="{ dragging: drag.on }"
          :style="cardStyle"
          @pointerdown="down"
          @pointermove="moveP"
          @pointerup="up"
          @pointercancel="up"
        >
          <img :src="posterUrl(cur)" :alt="m.title" draggable="false" />
          <div class="meta">
            <h3>{{ m.title }}</h3>
            <p>{{ m.year }} · {{ KINDS[m.kind] }} · {{ m.genres.map((g) => GENRES[g]).join(', ') }}</p>
            <span class="tag">{{ m.mine ? '★ из списка Xias' : '✦ рекомендация' }}</span>
          </div>
          <div v-if="target && target !== 'skip'" class="stamp" :data-tier="target">{{ TIERS[target].label }}</div>
        </div>
        <div v-else class="done">
          <b>Колода закончилась</b>
          <p>Смени подборку сверху или закрой окно.</p>
        </div>
      </div>
    </div>

    <footer class="pads">
      <button class="side" :disabled="!history.length" title="Назад (←)" @click="back">↶</button>
      <button
        v-for="k in ALL_TIERS"
        :key="k"
        :ref="setPad(k)"
        class="pad"
        :data-tier="k"
        :class="{ near: target === k }"
        :disabled="!cur"
        @click="send(k)"
      >
        <b>{{ TIERS[k].label }}</b>
        <small>{{ TIERS[k].note }}</small>
        <i v-if="counts[k]">{{ counts[k] }}</i>
      </button>
      <button class="side" :disabled="!cur" title="Пропустить (пробел / смахни вверх)" @click="throwAway">↑</button>
    </footer>
    <p class="keys">Тащи карточку на тир · смахни вверх, чтобы пропустить · <kbd>S</kbd>…<kbd>D</kbd> <kbd>X</kbd> · <kbd>←</kbd> назад · <kbd>Esc</kbd> выйти</p>
  </div>
</template>

<style scoped>
.deck {
  position: fixed; inset: 0; z-index: 60;
  display: grid; grid-template-rows: auto minmax(0, 1fr) auto auto;
  background:
    radial-gradient(circle, rgba(24, 22, 29, 0.1) 1px, transparent 1.4px) 0 0 / 8px 8px,
    radial-gradient(800px 500px at 50% 40%, rgba(255, 232, 0, 0.18), transparent 70%),
    var(--paper);
  animation: fade 0.15s ease;
  user-select: none;
  touch-action: none;
}
.deck-top { display: flex; align-items: center; gap: 12px; padding: 12px 16px; flex-wrap: wrap; }
.src { display: flex; gap: 6px; flex-wrap: wrap; }
.src button {
  border: 2px solid var(--ink); background: var(--surface); color: var(--ink);
  border-radius: 8px; padding: 5px 11px; font: 600 13px var(--font-body); cursor: pointer;
}
.src button:hover { background: var(--yellow); }
.src button.on { background: var(--ink); color: var(--surface); box-shadow: 2px 2px 0 var(--pink); }
.start { position: relative; flex: 0 1 300px; min-width: 180px; }
.start input {
  width: 100%; border: 2px solid var(--ink); border-radius: 9px; background: var(--surface);
  padding: 7px 12px; font: 500 14px var(--font-body); color: var(--ink); user-select: text;
}
.start input:focus { outline: none; box-shadow: 3px 3px 0 var(--pink); }
.found {
  position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 5;
  list-style: none; margin: 0; padding: 4px;
  background: var(--surface); border: 2px solid var(--ink); border-radius: 10px; box-shadow: 5px 5px 0 var(--ink);
}
.found button { display: flex; align-items: center; gap: 10px; width: 100%; background: none; border: 0; padding: 5px 6px; border-radius: 6px; cursor: pointer; text-align: left; font: 600 13px var(--font-body); color: var(--ink); }
.found button:hover { background: var(--yellow); }
.found img { width: 28px; height: 42px; object-fit: cover; border-radius: 3px; border: 1.5px solid var(--ink); }
.found small { color: var(--muted); font-family: var(--font-mono); }
.stat { margin-left: auto; font: 500 12px var(--font-mono); color: var(--muted); text-transform: uppercase; }
.stat b { color: var(--ink); }
.close { width: 36px; height: 36px; border: 2px solid var(--ink); background: var(--surface); border-radius: 9px; cursor: pointer; font-size: 15px; box-shadow: var(--hard); color: var(--ink); }
.close:hover { background: var(--pink); }

.stage { position: relative; display: grid; place-items: center; min-height: 0; padding: 8px; }
.pile { position: relative; width: min(340px, 62vw, calc((100dvh - 300px) / 1.5)); aspect-ratio: 2 / 3; }
.ghost-card, .card {
  position: absolute; inset: 0;
  border: 2.5px solid var(--ink); border-radius: 14px; overflow: hidden;
  background: var(--surface-2);
}
.ghost-card { transform: translate(calc(var(--i) * 7px), calc(var(--i) * 7px)) rotate(calc(var(--i) * 2.5deg)); box-shadow: 4px 4px 0 var(--ink); }
.ghost-card img, .card img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
.card { box-shadow: 8px 8px 0 var(--ink); cursor: grab; touch-action: none; will-change: transform; z-index: 2; animation: deal 0.28s cubic-bezier(.2,1.2,.4,1); }
.card.dragging { cursor: grabbing; box-shadow: 14px 14px 0 var(--pink); }
@keyframes deal { from { translate: 18px 18px; rotate: 5deg; scale: 0.96; } }
.meta {
  position: absolute; left: 0; right: 0; bottom: 0;
  padding: 40px 14px 12px;
  background: linear-gradient(transparent, rgba(24, 22, 29, 0.94) 45%);
  color: #fbf7ee;
}
.meta h3 { margin: 0 0 4px; font: 400 21px/1.12 var(--font-display); }
.meta p { margin: 0 0 8px; font: 500 12px/1.35 var(--font-body); opacity: 0.85; }
.tag { display: inline-block; font: 700 10.5px var(--font-mono); text-transform: uppercase; background: var(--yellow); color: var(--ink); padding: 3px 7px; border-radius: 4px; }
.stamp {
  position: absolute; top: 16px; right: 14px;
  width: 74px; height: 74px; display: grid; place-items: center;
  font: 400 44px/1 var(--font-display);
  color: var(--ink); background: var(--tc);
  border: 3px solid var(--ink); border-radius: 12px;
  rotate: 12deg; box-shadow: 4px 4px 0 var(--ink);
  animation: stamp 0.14s ease-out;
}
@keyframes stamp { from { scale: 1.6; opacity: 0; } }
.skip-hint { position: absolute; top: 6px; font: 700 13px var(--font-mono); text-transform: uppercase; background: var(--ink); color: var(--surface); padding: 6px 12px; border-radius: 6px; z-index: 3; }
.done { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; border: 2.5px dashed var(--ink); border-radius: 14px; padding: 20px; }
.done b { font: 400 22px var(--font-display); }
.done p { color: var(--muted); margin: 8px 0 0; }

.pads { display: flex; justify-content: center; align-items: stretch; gap: 10px; padding: 6px 16px 4px; }
.pad {
  position: relative; flex: 0 1 112px; min-width: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  height: 92px; border: 2.5px solid var(--ink); border-radius: 12px;
  background: var(--tc); color: var(--ink); cursor: pointer;
  box-shadow: 4px 4px 0 var(--ink);
  transition: transform 0.12s cubic-bezier(.2,1.4,.4,1), box-shadow 0.12s;
  overflow: hidden;
}
.pad::before { content: ""; position: absolute; inset: 0; background: radial-gradient(circle, rgba(24, 22, 29, 0.22) 1.05px, transparent 1.5px) 0 0 / 6px 6px; opacity: 0.5; }
.pad > * { position: relative; }
.pad b { font: 400 38px/1 var(--font-display); }
.pad small { font: 700 10px var(--font-mono); text-transform: uppercase; letter-spacing: 0.03em; }
.pad i { position: absolute; top: 5px; right: 6px; font: 700 11px var(--font-mono); font-style: normal; background: var(--ink); color: var(--surface); border-radius: 5px; padding: 1px 5px; }
.pad:hover:not(:disabled), .pad.near { transform: translate(-3px, -6px); box-shadow: 7px 10px 0 var(--ink); }
.pad.near { outline: 3px solid var(--ink); outline-offset: 3px; }
.pad.hit { animation: hit 0.32s ease; }
@keyframes hit { 40% { translate: 0 4px; scale: 0.94; } }
.pad:disabled { opacity: 0.5; cursor: default; }
.pad[data-tier='S'], .stamp[data-tier='S'] { --tc: var(--t-s); }
.pad[data-tier='A'], .stamp[data-tier='A'] { --tc: var(--t-a); }
.pad[data-tier='B'], .stamp[data-tier='B'] { --tc: var(--t-b); }
.pad[data-tier='C'], .stamp[data-tier='C'] { --tc: var(--t-c); }
.pad[data-tier='D'], .stamp[data-tier='D'] { --tc: var(--t-d); }
.pad[data-tier='X'], .stamp[data-tier='X'] { --tc: var(--t-x); }
.side { width: 52px; flex: none; border: 2.5px solid var(--ink); border-radius: 12px; background: var(--surface); font-size: 22px; cursor: pointer; box-shadow: 4px 4px 0 var(--ink); color: var(--ink); }
.side:hover:not(:disabled) { background: var(--yellow); }
.side:disabled { opacity: 0.4; cursor: default; }
.keys { margin: 6px 0 12px; text-align: center; font: 500 11px/2 var(--font-mono); color: var(--muted); text-transform: uppercase; }
kbd { font: 700 11px/1 var(--font-mono); padding: 3px 6px; border-radius: 4px; background: var(--surface); border: 1.5px solid var(--ink); color: var(--ink); }

@media (max-width: 700px) {
  .deck-top { padding: 10px; gap: 8px; }
  .start { flex: 1 1 100%; order: 3; }
  .stat { margin-left: 0; order: 2; }
  .close { position: absolute; top: 10px; right: 10px; }
  .pads { gap: 5px; padding: 6px 8px 4px; }
  .pad { height: 68px; flex-basis: 0; flex-grow: 1; border-width: 2px; box-shadow: 2px 2px 0 var(--ink); }
  .pad b { font-size: 26px; }
  .pad small { display: none; }
  .side { width: 38px; box-shadow: 2px 2px 0 var(--ink); }
  .keys { display: none; }
  .pile { width: min(270px, 70vw, calc((100dvh - 300px) / 1.5)); }
}
</style>
