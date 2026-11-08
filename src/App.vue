<script setup lang="ts">
import { computed, ref } from 'vue'
import Board from './components/Board.vue'
import Stats from './components/Stats.vue'
import Mirror from './components/Mirror.vue'
import MovieSheet from './components/MovieSheet.vue'
import ShareModal from './components/ShareModal.vue'
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
  if (count.value && !confirm('Убрать все фильмы обратно в коробку и начать свой тирлист с нуля? (Отменить можно через Ctrl+Z)')) return
  clearAll()
}
function doXias() {
  menu.value = false
  if (!confirm('Вернуть тирлист Xias? Текущая раскладка заменится (отменить можно через Ctrl+Z).')) return
  resetToXias()
}
</script>

<template>
  <div class="shell" :class="'page-' + page">
    <header class="top">
      <a class="logo" href="#/" @click.prevent="go('')">
        <span class="mark" aria-hidden="true"><i /></span>
        <b>Ламповый тирлист</b>
      </a>
      <nav>
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
          <button class="ghost" aria-label="Сброс" @click="menu = !menu">Сброс</button>
          <div v-if="menu" class="drop" @mouseleave="menu = false">
            <button @click="doClear">Начать свой с нуля</button>
            <button :disabled="!XIAS" @click="doXias">Вернуть тирлист Xias<small v-if="!XIAS"> · скоро</small></button>
          </div>
        </div>
      </div>
    </header>

    <main :class="{ scroll: page !== 'board' }">
      <Board v-if="page === 'board'" @open="sheet = $event" />
      <div v-else class="page"><Stats v-if="page === 'stats'" @open="sheet = $event" /><Mirror v-else @open="sheet = $event" /></div>
    </main>
  </div>

  <MovieSheet v-if="sheet" :id="sheet" @close="sheet = null" />
  <ShareModal v-if="share" :mode="share" @close="share = null" />
</template>

<style scoped>
.shell { height: 100dvh; display: grid; grid-template-rows: auto minmax(0, 1fr); }
.top {
  display: flex; align-items: center; gap: 16px;
  padding: 8px 12px;
  min-width: 0;
}
.logo { display: flex; align-items: center; gap: 10px; color: var(--text); text-decoration: none; flex: none; }
.logo b { font: 600 19px/1 var(--font-display); letter-spacing: -0.01em; white-space: nowrap; }
.mark {
  width: 30px; height: 30px; border-radius: 9px;
  background: var(--accent);
  display: grid; place-items: center;
  box-shadow: 0 0 22px -2px var(--accent-glow);
}
.mark i { width: 12px; height: 12px; border-radius: 50%; background: var(--on-accent); box-shadow: 0 0 0 3px color-mix(in oklab, var(--on-accent) 25%, transparent); }
nav { display: flex; gap: 2px; padding: 3px; background: var(--surface); border-radius: 12px; box-shadow: inset 0 0 0 1px var(--line); }
nav a { color: var(--muted); text-decoration: none; font-weight: 600; font-size: 14px; padding: 6px 12px; border-radius: 9px; transition: color 0.15s, background 0.15s; }
nav a.on { color: var(--text); background: var(--surface-3); }
nav a:hover { color: var(--text); }
.meter { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; min-width: 0; }
.meter .bar { width: 120px; height: 6px; border-radius: 99px; background: var(--surface-2); overflow: hidden; }
.meter .bar i { display: block; height: 100%; background: var(--accent); border-radius: 99px; transition: width 0.3s ease; }
.meter b { color: var(--text); }
.actions { margin-left: auto; display: flex; gap: 6px; align-items: center; }
.more { position: relative; }
.drop {
  position: absolute; right: 0; top: calc(100% + 6px); z-index: 30;
  background: var(--surface-2); border-radius: 12px;
  padding: 6px; min-width: 230px; box-shadow: var(--shadow-lg), inset 0 0 0 1px var(--line);
  display: flex; flex-direction: column;
}
.drop button { text-align: left; background: none; border: 0; color: var(--text); padding: 9px 10px; border-radius: 8px; font: 600 14px var(--font-body); cursor: pointer; }
.drop button:hover:not(:disabled) { background: var(--surface-3); }
.drop button:disabled { color: var(--muted); cursor: not-allowed; }
main { min-height: 0; padding: 0 12px 12px; }
.page-board main { overflow: hidden; }
main.scroll { overflow-y: auto; }
.page { max-width: 1280px; margin: 0 auto; padding-top: 4px; }

@media (max-width: 900px) {
  .shell { height: auto; min-height: 100dvh; display: block; }
  .page-board main { overflow: visible; }
  main.scroll { overflow: visible; }
  .meter .bar { width: 70px; }
}
@media (max-width: 700px) {
  .top { flex-wrap: wrap; gap: 8px 10px; padding: 10px; }
  .logo b { font-size: 17px; }
  nav { margin-left: auto; }
  .meter { order: 4; width: 100%; }
  .meter .bar { flex: 1; width: auto; }
  .actions { order: 3; margin-left: 0; width: 100%; }
  .actions > * { flex: 1; }
  .actions .btn, .actions .ghost { justify-content: center; width: 100%; padding: 9px 8px; white-space: nowrap; font-size: 13px; }
  main { padding: 0 10px 16px; }
}
</style>
