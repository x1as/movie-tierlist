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

function padAt(x: number, y: number): TierKey | 'skip' | null {
  for (const k of [...ALL_TIERS, 'skip'] as (TierKey | 'skip')[]) {
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
const KEYS: Record<string, TierKey | 'skip'> = {
  s: 'S', a: 'A', b: 'B', c: 'C', d: 'D', x: 'skip',
  ы: 'S', ф: 'A', и: 'B', с: 'C', в: 'D', ч: 'skip',
  '1': 'S', '2': 'A', '3': 'B', '4': 'C', '5': 'D', '6': 'skip',
}
function onKey(e: KeyboardEvent) {
  if ((e.target as HTMLElement)?.closest?.('input')) { if (e.key === 'Escape') q.value = ''; return }
  if (e.ctrlKey || e.metaKey || e.altKey) return
  const k = e.key.toLowerCase()
  if (k === 'escape') return emit('close')
  if (k === ' ' || k === 'arrowup') { e.preventDefault(); return throwAway() }
  if (k === 'backspace' || k === 'arrowleft') { e.preventDefault(); return back() }
  const kk = KEYS[k]
  if (kk) { e.preventDefault(); kk === 'skip' ? throwAway() : send(kk) }
}
const hold = (v: boolean) => window.dispatchEvent(new CustomEvent('kt-scene-hold', { detail: v }))
onMounted(() => { window.addEventListener('keydown', onKey); hold(true) })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); hold(false) })
const placedNow = computed(() => Object.values(counts).reduce((a, b) => a + b, 0))
const setPad = (k: string) => (el: unknown) => { if (el) pads.value[k] = el as HTMLElement }
</script>

<template>
  <div class="deck" role="dialog" aria-label="Раскладка карточками">
    <header class="deck-top">
      <div class="src">
        <button :class="{ on: source === 'filter' }" @click="setSource('filter')">Как в каталоге</button>
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
      <div v-if="target === 'skip'" class="skip-hint">оставить в каталоге</div>
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
      <button :ref="setPad('skip')" class="pad pad-skip" :class="{ near: target === 'skip' }" :disabled="!cur" title="Оставить в каталоге (X, пробел, смахни вверх)" @click="throwAway">
        <b>👁‍🗨</b><small>не смотрел</small>
      </button>
    </footer>
    <p class="keys">Тащи карточку на тир · вверх или <kbd>X</kbd> — не смотрел, останется в каталоге · <kbd>S</kbd>…<kbd>D</kbd> · <kbd>←</kbd> назад · <kbd>Esc</kbd> выйти</p>
  </div>
</template>

<style scoped>
.deck {
  position: fixed; inset: 0; z-index: 60;
  display: grid; grid-template-rows: auto minmax(0, 1fr) auto auto;
  background:
    radial-gradient(700px 480px at 50% 42%, rgba(139, 92, 255, 0.28), transparent 70%),
    radial-gradient(500px 300px at 50% 100%, rgba(255, 43, 214, 0.22), transparent 70%),
    rgba(6, 4, 14, 0.82);
  backdrop-filter: blur(8px);
  animation: fade 0.15s ease;
  user-select: none;
  touch-action: none;
}
.deck-top { display: flex; align-items: center; gap: 12px; padding: 14px 18px; flex-wrap: wrap; }
.src { display: flex; padding: 4px; gap: 2px; border-radius: 16px; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line); flex-wrap: wrap; }
.src button { border: 0; background: transparent; color: var(--text-2); border-radius: 12px; padding: 7px 14px; font: 600 13.5px var(--font-body); cursor: pointer; transition: background 0.15s, color 0.15s; }
.src button:hover { color: var(--text); }
.src button.on { background: var(--text); color: var(--on-tier); }
.start { position: relative; flex: 0 1 320px; min-width: 200px; }
.start input {
  width: 100%; height: 42px; border: 0; border-radius: 99px; background: var(--surface-2);
  box-shadow: inset 0 0 0 1px var(--line);
  padding: 0 16px; font: 500 14px var(--font-body); color: var(--text); user-select: text;
}
.start input::placeholder { color: var(--muted); }
.start input:focus { outline: none; box-shadow: inset 0 0 0 1.5px var(--accent), 0 0 24px -6px var(--accent-glow); }
.found {
  position: absolute; top: calc(100% + 8px); left: 0; right: 0; z-index: 5;
  list-style: none; margin: 0; padding: 6px;
  background: var(--surface-solid); border-radius: 18px; box-shadow: var(--shadow-lg);
}
.found button { display: flex; align-items: center; gap: 10px; width: 100%; background: none; border: 0; padding: 6px 8px; border-radius: 12px; cursor: pointer; text-align: left; font: 600 13.5px var(--font-body); color: var(--text); }
.found button:hover { background: var(--surface-3); }
.found img { width: 30px; height: 45px; object-fit: cover; border-radius: 6px; }
.found small { color: var(--muted); }
.stat { margin-left: auto; font: 600 13px var(--font-body); color: var(--muted); font-variant-numeric: tabular-nums; }
.stat b { color: var(--text); }
.close { width: 40px; height: 40px; border: 0; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line); border-radius: 14px; cursor: pointer; font-size: 15px; color: var(--text); }
.close:hover { background: var(--surface-3); }

.stage { position: relative; display: grid; place-items: center; min-height: 0; padding: 8px; perspective: 1200px; }
.pile { position: relative; width: min(340px, 62vw, calc((100dvh - 300px) / 1.5)); aspect-ratio: 2 / 3; }
.ghost-card, .card { position: absolute; inset: 0; border-radius: 24px; overflow: hidden; background: #1a1430; }
.ghost-card {
  transform: translate(calc(var(--i) * 10px), calc(var(--i) * -6px)) rotate(calc(var(--i) * 4deg)) scale(calc(1 - var(--i) * 0.04));
  opacity: calc(1 - var(--i) * 0.3);
  box-shadow: 0 0 0 1px var(--line-2);
}
.ghost-card img, .card img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
.card {
  z-index: 2; cursor: grab; touch-action: none; will-change: transform;
  box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.16), 0 0 60px -14px var(--accent), 0 40px 70px -30px rgba(0, 0, 0, 0.95);
  animation: deal 0.3s cubic-bezier(.2,1.2,.4,1);
}
.card::after { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; background: linear-gradient(125deg, rgba(255, 255, 255, 0.22), transparent 35%); }
.card.dragging { cursor: grabbing; box-shadow: 0 0 0 2px var(--accent), 0 0 90px -10px var(--accent), 0 50px 80px -30px rgba(0, 0, 0, 0.95); }
@keyframes deal { from { translate: 14px -10px; rotate: 6deg; scale: 0.95; opacity: 0.4; } }
.meta { position: absolute; left: 0; right: 0; bottom: 0; padding: 60px 18px 16px; background: linear-gradient(transparent, rgba(8, 5, 20, 0.96) 50%); color: #fff; }
.meta h3 { margin: 0 0 6px; font: 800 22px/1.12 var(--font-body); letter-spacing: -0.02em; }
.meta p { margin: 0 0 10px; font: 500 12.5px/1.35 var(--font-body); color: var(--text-2); }
.tag { display: inline-block; font: 700 11px var(--font-body); background: var(--grad); color: #fff; padding: 4px 10px; border-radius: 99px; }
.stamp {
  position: absolute; top: 18px; right: 16px;
  width: 78px; height: 78px; display: grid; place-items: center;
  font: 800 42px/1 var(--font-display);
  color: var(--on-tier); background: var(--tg);
  border-radius: 20px; rotate: 12deg;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 0 40px var(--tc);
  animation: stamp 0.14s ease-out;
}
@keyframes stamp { from { scale: 1.6; opacity: 0; } }
.skip-hint { position: absolute; top: 6px; z-index: 3; font: 700 13px var(--font-body); background: var(--text); color: var(--on-tier); padding: 8px 16px; border-radius: 99px; }
.done { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; border-radius: 24px; padding: 20px; box-shadow: inset 0 0 0 1.5px var(--line-2); background: var(--surface); }
.done b { font: 800 22px var(--font-body); }
.done p { color: var(--muted); margin: 8px 0 0; }

.pads { display: flex; justify-content: center; align-items: stretch; gap: 12px; padding: 6px 16px 4px; }
.pad {
  position: relative; flex: 0 1 116px; min-width: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  height: 96px; border: 0; border-radius: 22px;
  background: var(--tg); color: var(--on-tier); cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), inset 0 -12px 20px rgba(0, 0, 0, 0.2), 0 12px 30px -12px var(--tc);
  transition: transform 0.16s cubic-bezier(.2,1.4,.4,1), box-shadow 0.16s;
  overflow: hidden;
}
.pad::after { content: ""; position: absolute; inset: 0; background: linear-gradient(115deg, rgba(255, 255, 255, 0.4) 0 20%, transparent 20%); mix-blend-mode: soft-light; pointer-events: none; }
.pad b { font: 800 36px/1 var(--font-display); }
.pad small { font: 700 11px var(--font-body); opacity: 0.8; }
.pad i { position: absolute; top: 7px; right: 8px; font: 800 11px var(--font-body); font-style: normal; background: rgba(11, 7, 22, 0.85); color: #fff; border-radius: 99px; padding: 2px 7px; }
.pad:hover:not(:disabled), .pad.near { transform: translateY(-8px) scale(1.04); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 0 0 2px rgba(255, 255, 255, 0.85), 0 0 50px -4px var(--tc); }
.pad.hit { animation: hit 0.32s ease; }
@keyframes hit { 40% { translate: 0 5px; scale: 0.92; } }
.pad:disabled { opacity: 0.45; cursor: default; }
.pad[data-tier='S'], .stamp[data-tier='S'] { --tc: var(--t-s); --tg: var(--g-s); }
.pad[data-tier='A'], .stamp[data-tier='A'] { --tc: var(--t-a); --tg: var(--g-a); }
.pad[data-tier='B'], .stamp[data-tier='B'] { --tc: var(--t-b); --tg: var(--g-b); }
.pad[data-tier='C'], .stamp[data-tier='C'] { --tc: var(--t-c); --tg: var(--g-c); }
.pad[data-tier='D'], .stamp[data-tier='D'] { --tc: var(--t-d); --tg: var(--g-d); }
.pad-skip { --tc: rgba(255, 255, 255, 0.35); --tg: linear-gradient(150deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.05)); color: var(--text); box-shadow: inset 0 0 0 1px var(--line-2); }
.pad-skip b { font-size: 28px; font-family: var(--font-body); }
.side { width: 56px; flex: none; border: 0; border-radius: 22px; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line); font-size: 22px; cursor: pointer; color: var(--text); }
.side:hover:not(:disabled) { background: var(--surface-3); }
.side:disabled { opacity: 0.35; cursor: default; }
.keys { margin: 8px 0 14px; text-align: center; font: 500 12px/2 var(--font-body); color: var(--muted); }
kbd { font: 700 11px/1 var(--font-body); padding: 4px 7px; border-radius: 7px; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line-2); color: var(--text); }

@media (max-width: 700px) {
  .deck-top { padding: 10px; gap: 8px; }
  .start { flex: 1 1 100%; order: 3; }
  .stat { margin-left: 0; order: 2; }
  .close { position: absolute; top: 10px; right: 10px; }
  .pads { gap: 6px; padding: 6px 8px 10px; }
  .pad { height: 70px; flex-basis: 0; flex-grow: 1; border-radius: 16px; }
  .pad b { font-size: 24px; }
  .pad-skip b { font-size: 20px; }
  .pad small { display: none; }
  .side { width: 40px; border-radius: 16px; }
  .keys { display: none; }
  .pile { width: min(270px, 70vw, calc((100dvh - 300px) / 1.5)); }
}
</style>
