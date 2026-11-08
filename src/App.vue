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
        <svg class="mark" viewBox="0 0 40 40" aria-hidden="true">
          <g fill="none" stroke-width="3.2">
            <circle cx="21.5" cy="21.5" r="14" stroke="#0078bf" opacity=".75" />
            <circle cx="21.5" cy="21.5" r="6.5" stroke="#0078bf" opacity=".75" />
            <circle cx="19" cy="19" r="14" stroke="#ff48b0" />
            <circle cx="19" cy="19" r="6.5" stroke="#ff48b0" />
          </g>
          <path d="M19 1v12M19 25v12M1 19h12M25 19h12" stroke="#18161d" stroke-width="2.6" />
          <circle cx="19" cy="19" r="2.4" fill="#18161d" />
        </svg>
        <b>КИНОТИР</b>
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
  display: flex; align-items: center; gap: 14px;
  padding: 10px 14px 12px;
  min-width: 0;
}
.logo { display: flex; align-items: center; gap: 9px; color: var(--ink); text-decoration: none; flex: none; }
.mark { width: 34px; height: 34px; transition: rotate 0.4s cubic-bezier(.2,.8,.2,1); }
.logo:hover .mark { rotate: 90deg; }
.logo b { font: 400 24px/1 var(--font-display); letter-spacing: 0.01em; text-shadow: var(--misreg); }
nav { display: flex; gap: 4px; }
nav a {
  color: var(--ink); text-decoration: none;
  font: 600 13.5px var(--font-body);
  padding: 6px 12px; border-radius: 8px; border: 2px solid transparent;
  transition: background 0.1s, border-color 0.1s;
}
nav a:hover { border-color: var(--ink); }
nav a.on { background: var(--ink); color: var(--surface); border-color: var(--ink); box-shadow: 2px 2px 0 var(--pink); }
.meter { display: flex; align-items: center; gap: 10px; font: 500 12px var(--font-mono); color: var(--muted); min-width: 0; }
.meter .bar {
  width: 150px; height: 12px; border-radius: 99px;
  border: 2px solid var(--ink); background: var(--surface);
  overflow: hidden;
}
.meter .bar i {
  display: block; height: 100%;
  background: repeating-linear-gradient(-45deg, var(--pink) 0 6px, color-mix(in oklab, var(--pink), white 35%) 6px 12px);
  border-right: 2px solid var(--ink);
  transition: width 0.3s ease;
}
.meter b { color: var(--ink); font-weight: 700; }
.actions { margin-left: auto; display: flex; gap: 8px; align-items: center; }
.more { position: relative; }
.drop {
  position: absolute; right: 0; top: calc(100% + 8px); z-index: 30;
  background: var(--surface); border: 2px solid var(--ink); border-radius: 10px;
  padding: 5px; min-width: 230px; box-shadow: 5px 5px 0 var(--ink);
  display: flex; flex-direction: column;
}
.drop button { text-align: left; background: none; border: 0; color: var(--ink); padding: 9px 10px; border-radius: 6px; font: 600 14px var(--font-body); cursor: pointer; }
.drop button:hover:not(:disabled) { background: var(--yellow); }
.drop button:disabled { color: var(--muted); cursor: not-allowed; }
main { min-height: 0; padding: 0 14px 14px; }
.page-board main { overflow: hidden; }
main.scroll { overflow-y: auto; }
.page { max-width: 1280px; margin: 0 auto; padding: 4px 8px 8px 0; }

@media (max-width: 900px) {
  .shell { height: auto; min-height: 100dvh; display: block; }
  .page-board main { overflow: visible; }
  main.scroll { overflow: visible; }
  .meter .bar { width: 80px; }
}
@media (max-width: 700px) {
  .top { flex-wrap: wrap; gap: 10px; padding: 10px; }
  nav { margin-left: auto; }
  .meter { order: 4; width: 100%; }
  .meter .bar { flex: 1; width: auto; }
  .actions { order: 3; margin-left: 0; width: 100%; }
  .actions > * { flex: 1; }
  .actions .btn, .actions .ghost { justify-content: center; width: 100%; padding: 0 8px; font-size: 13px; }
  main { padding: 0 10px 16px; }
}
</style>
