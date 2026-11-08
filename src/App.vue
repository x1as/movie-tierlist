<script setup lang="ts">
import { computed, ref } from 'vue'
import Board from './components/Board.vue'
import Stats from './components/Stats.vue'
import Mirror from './components/Mirror.vue'
import MovieSheet from './components/MovieSheet.vue'
import ShareModal from './components/ShareModal.vue'
import { route, go, SECRET } from './lib/router'
import { state, placed, clearAll, resetToXias } from './lib/store'
import { XIAS } from './data/xias'
import { MOVIES } from './data/movies'

const sheet = ref<string | null>(null)
const share = ref<'export' | 'import' | null>(null)
const menu = ref(false)
const page = computed(() => (route.value === SECRET ? 'mirror' : route.value === 'stats' ? 'stats' : 'board'))
const count = computed(() => placed.value.size)

function doClear() {
  menu.value = false
  if (count.value && !confirm('Убрать все фильмы обратно в коробку и начать свой тирлист с нуля?')) return
  clearAll()
}
function doXias() {
  menu.value = false
  if (!confirm('Вернуть тирлист Xias? Текущая раскладка заменится (сначала можно выгрузить её).')) return
  resetToXias()
}
</script>

<template>
  <header class="top">
    <a class="logo" href="#/" @click.prevent="go('')">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <defs><radialGradient id="glow"><stop offset="0" stop-color="#ffcf8a" stop-opacity=".9" /><stop offset="1" stop-color="#ffcf8a" stop-opacity="0" /></radialGradient></defs>
        <circle cx="32" cy="36" r="26" fill="url(#glow)" />
        <path d="M20 8h24l8 24H12z" fill="var(--accent)" />
        <rect x="29" y="32" width="6" height="18" fill="var(--muted)" />
        <rect x="18" y="50" width="28" height="6" rx="3" fill="var(--muted)" />
      </svg>
      <span><b>Ламповый тирлист</b><small>фильмы · мульты · сериалы</small></span>
    </a>
    <nav>
      <a href="#/" :class="{ on: page === 'board' }">Тирлист</a>
      <a href="#/stats" :class="{ on: page === 'stats' }">Итоги</a>
    </nav>
    <div class="actions">
      <button class="btn" @click="share = 'export'">Выгрузить</button>
      <button class="ghost" @click="share = 'import'">Загрузить</button>
      <div class="more">
        <button class="ghost" aria-label="Сброс" @click="menu = !menu">Сброс ▾</button>
        <div v-if="menu" class="drop" @mouseleave="menu = false">
          <button @click="doClear">Начать свой с нуля</button>
          <button :disabled="!XIAS" @click="doXias">Вернуть тирлист Xias<small v-if="!XIAS"> — скоро</small></button>
        </div>
      </div>
    </div>
  </header>

  <main>
    <div v-if="page === 'board'" class="banner">
      <template v-if="state.isXias">
        <b>Это тирлист Xias.</b> Подвинь любой постер — и он станет твоим. Или нажми «Сброс → Начать свой с нуля». Готовый тирлист выгрузи и отправь Xias.
      </template>
      <template v-else>
        <b>{{ count ? `Разложено ${count} из ${MOVIES.length}.` : 'Собери свой тирлист.' }}</b>
        В коробке {{ MOVIES.length }} фильмов, мультиков и сериалов: часть из любимого Xias, остальное подобрано под его вкус.
        Не смотрел — кидай в «—», это не испортит итоги.
      </template>
    </div>

    <Board v-if="page === 'board'" @open="sheet = $event" />
    <Stats v-else-if="page === 'stats'" @open="sheet = $event" />
    <Mirror v-else @open="sheet = $event" />
  </main>

  <footer>Сделано с теплом · постеры: Википедия · данные хранятся только в твоём браузере</footer>

  <MovieSheet v-if="sheet" :id="sheet" @close="sheet = null" />
  <ShareModal v-if="share" :mode="share" @close="share = null" />
</template>

<style scoped>
.top {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; gap: 18px;
  padding: 10px 24px;
  background: color-mix(in oklab, var(--bg) 82%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--line);
}
.logo { display: flex; align-items: center; gap: 10px; color: var(--text); text-decoration: none; }
.logo svg { width: 38px; height: 38px; }
.logo span { display: flex; flex-direction: column; line-height: 1.05; }
.logo b { font: 700 20px var(--font-display); }
.logo small { font: 600 15px var(--font-hand); color: var(--muted); }
nav { display: flex; gap: 4px; margin-left: 10px; }
nav a { color: var(--muted); text-decoration: none; font-weight: 800; padding: 7px 12px; border-radius: 10px; }
nav a.on { color: var(--text); background: var(--panel-2); }
nav a:hover { color: var(--text); }
.actions { margin-left: auto; display: flex; gap: 8px; align-items: center; }
.more { position: relative; }
.drop {
  position: absolute; right: 0; top: calc(100% + 6px);
  background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
  padding: 6px; min-width: 230px; box-shadow: var(--shadow-lg);
  display: flex; flex-direction: column;
}
.drop button { text-align: left; background: none; border: 0; color: var(--text); padding: 9px 10px; border-radius: 8px; font: 700 14px var(--font-body); cursor: pointer; }
.drop button:hover:not(:disabled) { background: var(--panel-2); }
.drop button:disabled { color: var(--muted); cursor: not-allowed; }
main { max-width: 1440px; margin: 0 auto; padding: 18px 24px 40px; }
.banner {
  margin-bottom: 14px; padding: 12px 16px;
  border-radius: 14px;
  background: linear-gradient(90deg, rgba(242, 166, 90, 0.13), rgba(242, 166, 90, 0.03));
  border: 1px solid rgba(242, 166, 90, 0.25);
  color: var(--text-2); line-height: 1.5; font-size: 14px;
}
.banner b { color: var(--text); }
footer { text-align: center; color: var(--muted); font: 600 18px var(--font-hand); padding: 10px 16px 30px; }
@media (max-width: 760px) {
  .top { flex-wrap: wrap; gap: 8px 12px; padding: 10px 16px; position: static; }
  .logo small { display: none; }
  nav { margin-left: auto; }
  .actions { margin-left: 0; width: 100%; }
  .actions > * { flex: 1; }
  .actions .btn, .actions .ghost { justify-content: center; width: 100%; padding: 9px 8px; white-space: nowrap; font-size: 13px; }
  main { padding: 14px 16px 30px; }
}
</style>
