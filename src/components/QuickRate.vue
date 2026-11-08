<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Poster from './Poster.vue'
import { ALL_TIERS, GENRES, KINDS, TIERS, type TierKey } from '../data/meta'
import { BY_ID } from '../data/movies'
import { move, placed } from '../lib/store'
import { posterUrl } from '../lib/posters'

// Быстрая раскладка: по одному постеру, кнопка или клавиша — и следующий
const props = defineProps<{ ids: string[] }>()
const emit = defineEmits<{ close: [] }>()

const queue = ref([...props.ids])
const pos = ref(0)
const done = ref<{ id: string; tier: TierKey | null }[]>([])
const cur = computed(() => queue.value[pos.value])
const m = computed(() => (cur.value ? BY_ID[cur.value] : null))
const left = computed(() => queue.value.length - pos.value)
const flash = ref<TierKey | null>(null)

// подгружаем следующие постеры заранее
const preload = computed(() => queue.value.slice(pos.value + 1, pos.value + 4))

function rate(t: TierKey) {
  if (!cur.value) return
  move(cur.value, t)
  done.value.push({ id: cur.value, tier: t })
  flash.value = t
  setTimeout(() => (flash.value = null), 260)
  pos.value++
  if (!cur.value) setTimeout(() => emit('close'), 300)
}
function skip() {
  if (!cur.value) return
  done.value.push({ id: cur.value, tier: null })
  pos.value++
  if (!cur.value) emit('close')
}
function back() {
  const last = done.value.pop()
  if (!last) return
  if (last.tier) move(last.id, null)
  pos.value--
}

const KEYS: Record<string, TierKey> = {
  s: 'S', a: 'A', b: 'B', c: 'C', d: 'D', x: 'X',
  ы: 'S', ф: 'A', и: 'B', с: 'C', в: 'D', ч: 'X',
  '1': 'S', '2': 'A', '3': 'B', '4': 'C', '5': 'D', '6': 'X',
}
function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  const k = e.key.toLowerCase()
  if (k === 'escape') return emit('close')
  if (k === ' ' || k === 'arrowright') { e.preventDefault(); return skip() }
  if (k === 'backspace' || k === 'arrowleft') { e.preventDefault(); return back() }
  if (KEYS[k]) { e.preventDefault(); rate(KEYS[k]) }
}

// свайпы: вправо — пропустить, влево — назад
let sx = 0
const ts = (e: TouchEvent) => (sx = e.touches[0].clientX)
const te = (e: TouchEvent) => {
  const dx = e.changedTouches[0].clientX - sx
  if (dx < -60) skip()
  else if (dx > 60) back()
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
const placedCount = computed(() => done.value.filter((d) => d.tier).length)
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="quick" role="dialog" aria-label="Быстрая раскладка">
      <div class="bar">
        <span class="count"><b>{{ placedCount }}</b> разложено · осталось {{ left }}</span>
        <button class="x" aria-label="Закрыть" @click="emit('close')">✕</button>
      </div>
      <div class="progress"><div :style="{ width: (pos / Math.max(1, queue.length)) * 100 + '%' }" /></div>

      <div v-if="m && cur" class="body" @touchstart.passive="ts" @touchend="te">
        <div class="art" :class="flash ? 'fly-' + flash : ''">
          <Transition name="swap" mode="out-in">
            <Poster :key="cur" :id="cur" big :badge="placed.get(cur) ?? undefined" />
          </Transition>
        </div>
        <div class="info">
          <h3>{{ m.title }}</h3>
          <p class="meta">{{ m.year }} · {{ KINDS[m.kind] }}</p>
          <div class="tags"><span v-for="g in m.genres" :key="g">{{ GENRES[g] }}</span></div>
          <p class="src">{{ m.mine ? '★ из списка Xias' : '✦ рекомендация' }}</p>
        </div>
      </div>
      <p v-else class="fin">Всё разложено 🎞</p>

      <div class="tiers">
        <button v-for="k in ALL_TIERS" :key="k" :data-tier="k" :disabled="!cur" @click="rate(k)">
          <b>{{ TIERS[k].label }}</b><small>{{ TIERS[k].note }}</small>
        </button>
      </div>
      <div class="nav">
        <button class="ghost" :disabled="!done.length" @click="back">← Назад</button>
        <button class="ghost" :disabled="!cur" @click="skip">Пропустить →</button>
      </div>
      <p class="keys"><kbd>S</kbd>…<kbd>D</kbd> или <kbd>1</kbd>…<kbd>5</kbd>, <kbd>X</kbd> не смотрел, <kbd>Пробел</kbd> пропустить, <kbd>←</kbd> назад</p>
      <img v-for="id in preload" :key="id" :src="posterUrl(id)" alt="" hidden />
    </div>
  </div>
</template>

<style scoped>
.quick {
  width: min(560px, 100%);
  max-height: calc(100dvh - 24px);
  overflow-y: auto;
  background: var(--panel); border: 1px solid var(--line); border-radius: 22px;
  padding: 16px 20px 18px; box-shadow: var(--shadow-lg);
  display: flex; flex-direction: column; gap: 12px;
  animation: pop 0.2s ease;
}
.bar { display: flex; justify-content: space-between; align-items: center; }
.count { color: var(--muted); font-weight: 700; font-size: 14px; }
.count b { color: var(--accent); font-size: 18px; }
.x { background: none; border: 0; color: var(--muted); font-size: 18px; cursor: pointer; }
.progress { height: 5px; border-radius: 99px; background: var(--bg-2); overflow: hidden; }
.progress div { height: 100%; background: var(--accent); transition: width 0.25s ease; }
.body { display: grid; grid-template-columns: 200px 1fr; gap: 18px; align-items: end; touch-action: pan-y; }
.art { transition: transform 0.25s ease, opacity 0.25s ease; }
.info { padding-bottom: 6px; min-width: 0; }
h3 { margin: 0 0 4px; font: 700 26px/1.12 var(--font-display); }
.meta { margin: 0 0 10px; color: var(--muted); font-weight: 600; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tags span { font-size: 12px; font-weight: 700; padding: 4px 9px; border-radius: 999px; background: var(--bg-2); border: 1px solid var(--line); }
.src { font: 600 19px var(--font-hand); color: var(--accent); margin: 12px 0 0; }
.fin { text-align: center; font: 700 22px var(--font-display); padding: 40px 0; margin: 0; }
.tiers { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
.tiers button {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 12px 2px; border-radius: 12px; border: 0; cursor: pointer;
  background: var(--tc); color: #24170f;
  transition: transform 0.1s ease, filter 0.1s;
}
.tiers button:hover { filter: brightness(1.08); transform: translateY(-2px); }
.tiers button:active { transform: scale(0.96); }
.tiers button:disabled { opacity: 0.4; cursor: default; transform: none; }
.tiers b { font: 700 24px/1 var(--font-display); }
.tiers small { font-size: 11px; font-weight: 800; opacity: 0.8; }
.tiers [data-tier='S'] { --tc: var(--t-s); }
.tiers [data-tier='A'] { --tc: var(--t-a); }
.tiers [data-tier='B'] { --tc: var(--t-b); }
.tiers [data-tier='C'] { --tc: var(--t-c); }
.tiers [data-tier='D'] { --tc: var(--t-d); }
.tiers [data-tier='X'] { --tc: var(--t-x); color: var(--text); }
.nav { display: flex; justify-content: space-between; gap: 8px; }
.nav .ghost:disabled { opacity: 0.4; cursor: default; }
.keys { margin: 0; color: var(--muted); font-size: 12px; text-align: center; line-height: 1.9; }
kbd { font: 700 11px/1 var(--font-body); padding: 3px 6px; border-radius: 5px; background: var(--panel-2); border: 1px solid var(--line); border-bottom-width: 2px; color: var(--text); }
.swap-enter-active, .swap-leave-active { transition: opacity 0.14s ease, transform 0.14s ease; }
.swap-enter-from { opacity: 0; transform: translateX(16px) rotate(1.5deg); }
.swap-leave-to { opacity: 0; transform: translateX(-16px) rotate(-1.5deg); }
@media (max-height: 760px) and (min-width: 561px) {
  .body { grid-template-columns: 150px 1fr; }
}
@media (max-width: 560px) {
  .quick { padding: 14px; gap: 10px; }
  .body { grid-template-columns: 1fr; justify-items: center; text-align: center; gap: 10px; }
  .art { width: min(190px, 52vw); }
  .tags { justify-content: center; }
  h3 { font-size: 21px; }
  .src { margin-top: 6px; }
  .tiers { grid-template-columns: repeat(3, 1fr); }
  .tiers button { padding: 10px 2px; }
  .keys { display: none; }
}
</style>
