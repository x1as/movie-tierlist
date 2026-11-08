<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Board from './components/Board.vue'
import Stats from './components/Stats.vue'
import Mirror from './components/Mirror.vue'
import MovieSheet from './components/MovieSheet.vue'
import ShareModal from './components/ShareModal.vue'
import ScrollArea from './components/ScrollArea.vue'
import { route, go, SECRET } from './lib/router'
import { placed, clearAll, resetToXias } from './lib/store'
import { XIAS } from './data/xias'
import { MOVIES } from './data/movies'

const sheet = ref<string | null>(null)
const share = ref<'export' | 'import' | null>(null)
const menu = ref(false)
const page = computed(() => (route.value === SECRET ? 'mirror' : route.value === 'stats' ? 'stats' : 'board'))
const count = computed(() => placed.value.size)
const progress = computed(() => Math.round((count.value / MOVIES.length) * 100))

function doClear() {
  menu.value = false
  if (count.value && !confirm('Вернуть все фильмы в каталог и начать свой тирлист с нуля? (Отменить можно через Ctrl+Z)')) return
  clearAll()
}
function doXias() {
  menu.value = false
  if (!confirm('Вернуть тирлист Xias? Текущая раскладка заменится (отменить можно через Ctrl+Z).')) return
  resetToXias()
}

// 3D-фон грузится отдельно, после первого рендера интерфейса
const canvas = ref<HTMLCanvasElement | null>(null)
let stop: (() => void) | null = null
onMounted(async () => {
  try {
    const { startScene } = await import('./lib/scene')
    if (canvas.value) stop = startScene(canvas.value)
  } catch {}
})
onBeforeUnmount(() => stop?.())
</script>

<template>
  <canvas ref="canvas" class="bg3d" aria-hidden="true" />
  <div class="bg-veil" aria-hidden="true" />
  <div class="shell" :class="'page-' + page">
    <header class="top">
      <a class="logo" href="#/" @click.prevent="go('')">
        <span class="mark" aria-hidden="true">
          <svg viewBox="0 0 40 40">
            <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff2bd6" /><stop offset=".5" stop-color="#8b5cff" /><stop offset="1" stop-color="#22e4ff" /></linearGradient></defs>
            <path d="M20 3 35 11.5v17L20 37 5 28.5v-17z" fill="none" stroke="url(#lg)" stroke-width="2.6" stroke-linejoin="round" />
            <path d="M20 3v34M5 11.5l30 17M35 11.5l-30 17" stroke="url(#lg)" stroke-width="1.2" opacity=".55" />
            <circle cx="20" cy="20" r="4.2" fill="url(#lg)" />
          </svg>
        </span>
        <b>КИНОТИР</b>
      </a>
      <nav class="seg">
        <a href="#/" :class="{ on: page === 'board' }">Тирлист</a>
        <a href="#/stats" :class="{ on: page === 'stats' }">Итоги</a>
      </nav>
      <div class="meter" :title="`Разложено ${count} из ${MOVIES.length}`">
        <div class="bar"><i :style="{ width: progress + '%' }" /></div>
        <span><b>{{ count }}</b> / {{ MOVIES.length }}</span>
      </div>
      <div class="actions">
        <button class="btn" @click="share = 'export'">Выгрузить</button>
        <button class="ghost" @click="share = 'import'">Загрузить</button>
        <div class="more">
          <button class="ghost round" aria-label="Ещё" title="Сброс" @click="menu = !menu">
            <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
          </button>
          <div v-if="menu" class="drop" @mouseleave="menu = false">
            <button @click="doClear">Начать свой с нуля</button>
            <button :disabled="!XIAS" @click="doXias">Вернуть тирлист Xias<small v-if="!XIAS"> · скоро</small></button>
          </div>
        </div>
      </div>
    </header>

    <main>
      <Board v-if="page === 'board'" @open="sheet = $event" />
      <ScrollArea v-else class="page-scroll">
        <div class="page"><Stats v-if="page === 'stats'" @open="sheet = $event" /><Mirror v-else @open="sheet = $event" /></div>
      </ScrollArea>
    </main>
  </div>

  <MovieSheet v-if="sheet" :id="sheet" @close="sheet = null" />
  <ShareModal v-if="share" :mode="share" @close="share = null" />
</template>

<style scoped>
.shell { height: 100dvh; display: grid; grid-template-rows: auto minmax(0, 1fr); }
.top {
  display: flex; align-items: center; gap: 14px;
  margin: 10px 14px 12px;
  padding: 8px 8px 8px 14px;
  border-radius: 22px;
  background: rgba(14, 10, 26, 0.72);
  backdrop-filter: blur(14px) saturate(1.4);
  box-shadow: inset 0 0 0 1px var(--line), 0 16px 40px -24px rgba(0, 0, 0, 0.9);
  min-width: 0;
}
.logo { display: flex; align-items: center; gap: 10px; color: var(--text); text-decoration: none; flex: none; }
.mark { width: 34px; height: 34px; display: grid; place-items: center; filter: drop-shadow(0 0 8px rgba(255, 43, 214, 0.6)); transition: rotate 0.6s cubic-bezier(.2,.8,.2,1); }
.mark svg { width: 34px; height: 34px; }
.logo:hover .mark { rotate: 60deg; }
.logo b { font: 800 19px/1 var(--font-display); letter-spacing: 0.02em; }
.seg { display: flex; padding: 4px; border-radius: 16px; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line); }
.seg a { color: var(--text-2); text-decoration: none; font: 600 14px var(--font-body); padding: 7px 16px; border-radius: 12px; transition: color 0.15s, background 0.2s; }
.seg a:hover { color: var(--text); }
.seg a.on { background: var(--text); color: var(--on-tier); }
.meter { display: flex; align-items: center; gap: 10px; font: 600 13px var(--font-body); color: var(--muted); min-width: 0; font-variant-numeric: tabular-nums; }
.meter .bar { width: 160px; height: 8px; border-radius: 99px; background: var(--surface-2); overflow: hidden; box-shadow: inset 0 0 0 1px var(--line); }
.meter .bar i { display: block; height: 100%; border-radius: 99px; background: var(--grad); box-shadow: 0 0 14px var(--accent); transition: width 0.4s cubic-bezier(.2,.8,.2,1); }
.meter b { color: var(--text); }
.actions { margin-left: auto; display: flex; gap: 8px; align-items: center; }
.round { width: 40px; padding: 0; }
.round svg { width: 18px; height: 18px; fill: currentColor; }
.more { position: relative; }
.drop {
  position: absolute; right: 0; top: calc(100% + 10px); z-index: 30;
  background: var(--surface-solid); border-radius: 18px;
  padding: 6px; min-width: 240px; box-shadow: var(--shadow-lg);
  display: flex; flex-direction: column;
  animation: pop 0.15s ease;
}
.drop button { text-align: left; background: none; border: 0; color: var(--text); padding: 11px 12px; border-radius: 12px; font: 600 14px var(--font-body); cursor: pointer; }
.drop button:hover:not(:disabled) { background: var(--surface-3); }
.drop button:disabled { color: var(--muted); cursor: not-allowed; }
main { min-height: 0; padding: 0 14px 14px; }
.page-board main { overflow: hidden; }
.page-scroll { height: 100%; }
.page { max-width: 1280px; margin: 0 auto; padding: 0 8px 8px 0; }

@media (max-width: 900px) {
  .shell { height: auto; min-height: 100dvh; display: block; }
  .page-board main { overflow: visible; }
  .page-scroll :deep(.sa-vp) { overflow: visible; -webkit-mask-image: none; mask-image: none; }
  .meter .bar { width: 80px; }
}
@media (max-width: 700px) {
  .top { flex-wrap: wrap; gap: 10px; margin: 8px; padding: 10px; }
  .seg { margin-left: auto; }
  .meter { order: 4; width: 100%; }
  .meter .bar { flex: 1; width: auto; }
  .actions { order: 3; margin-left: 0; width: 100%; }
  .actions > .btn, .actions > .ghost { flex: 1; }
  main { padding: 0 8px 16px; }
}
</style>
