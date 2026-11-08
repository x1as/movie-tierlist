<script setup lang="ts">
import { computed } from 'vue'
import Poster from './Poster.vue'
import TypeCard from './TypeCard.vue'
import AxisBars from './AxisBars.vue'
import { profile, type GroupStat } from '../lib/analysis'
import { ALL_TIERS, TIERS } from '../data/meta'
import { state } from '../lib/store'
import { MOVIES } from '../data/movies'
import { go } from '../lib/router'

const emit = defineEmits<{ open: [id: string] }>()
const p = computed(() => profile(state.tiers))
const who = computed(() => (state.isXias ? 'Тип Xias' : state.name ? `Тип: ${state.name}` : 'Твой кино-тип'))
const solid = (g: GroupStat[], min = 3) => g.filter((x) => x.n >= min)
const top = computed(() => solid(p.value.genres)[0])
const bottom = computed(() => { const s = solid(p.value.genres); return s.length > 1 ? s[s.length - 1] : undefined })
const era = computed(() => solid(p.value.decades, 2)[0])
const fmt = computed(() => solid(p.value.kinds, 2)[0])
const distTotal = computed(() => ALL_TIERS.reduce((s, k) => s + p.value.dist[k], 0))
const fmtAvg = (x: number) => x.toFixed(2).replace('.', ',')
const verdict = (avg: number) => (avg >= 4.5 ? 'святое' : avg >= 3.8 ? 'любовь' : avg >= 3 ? 'нравится' : avg >= 2.2 ? 'терпимо' : 'не твоё')
</script>

<template>
  <section class="stats">
    <div v-if="p.ranked < 8" class="card empty">
      <h2>Пока маловато оценок</h2>
      <p>Разложи хотя бы 8 фильмов по тирам — и здесь появится кино-тип, разбор по жанрам и эпохам. Сейчас оценено: {{ p.ranked }}.</p>
      <button class="btn" @click="go('')">К тирлисту</button>
    </div>

    <template v-else>
      <div class="hero">
        <TypeCard :p="p" :who="who" />
        <div class="card">
          <h2>Шкалы вкуса</h2>
          <AxisBars :a="p.ax" />
          <p class="foot">Шкала считается по средней оценке в каждой группе и по тому, сколько ты туда поставил. «Не смотрел» не учитывается.</p>
        </div>
      </div>

      <div class="tiles">
        <div v-if="top" class="tile"><span>Любимый жанр</span><b>{{ top.label }}</b><small>в среднем {{ fmtAvg(top.avg) }} · {{ top.n }} шт.</small></div>
        <div v-if="bottom" class="tile"><span>Меньше всего заходит</span><b>{{ bottom.label }}</b><small>в среднем {{ fmtAvg(bottom.avg) }} · {{ bottom.n }} шт.</small></div>
        <div v-if="era" class="tile"><span>Золотая эпоха</span><b>{{ era.label }}</b><small>в среднем {{ fmtAvg(era.avg) }}</small></div>
        <div v-if="fmt" class="tile"><span>Любимый формат</span><b>{{ fmt.label }}</b><small>в среднем {{ fmtAvg(fmt.avg) }}</small></div>
        <div class="tile"><span>Оценено</span><b>{{ p.ranked }}</b><small>ещё {{ MOVIES.length - p.ranked }} в каталоге</small></div>
      </div>

      <div class="card">
        <h2>Как распределились тиры</h2>
        <div class="dist">
          <div v-for="k in ALL_TIERS" v-show="p.dist[k]" :key="k" class="seg" :data-tier="k" :style="{ flexGrow: p.dist[k] }" :title="`${TIERS[k].label} — ${TIERS[k].note}: ${p.dist[k]}`">
            <span v-if="p.dist[k] / distTotal > 0.06">{{ TIERS[k].label }} {{ p.dist[k] }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Жанры: от святого к чужому</h2>
        <p class="sub">Средний тир по жанру (S = 5, D = 1) и лучшие фильмы в нём. Жанры с одним-двумя фильмами стоят ниже — им не хватает данных.</p>
        <div class="genres">
          <div v-for="g in p.genres" :key="g.key" class="g" :title="`${g.label}: средняя ${fmtAvg(g.avg)}, фильмов ${g.n}, в S/A — ${g.loved}`">
            <div class="g-name"><b>{{ g.label }}</b><small>{{ g.n }} шт. · {{ verdict(g.avg) }}</small></div>
            <div class="g-bar"><div :style="{ width: (g.avg / 5) * 100 + '%' }" /><span>{{ fmtAvg(g.avg) }}</span></div>
            <div class="g-best" @click="(e) => { const id = (e.target as HTMLElement).closest('.poster')?.getAttribute('data-id'); if (id) emit('open', id) }">
              <Poster v-for="id in g.best" :key="id" :id="id" />
            </div>
          </div>
        </div>
      </div>

      <div class="two">
        <div class="card">
          <h2>Форматы</h2>
          <div v-for="g in p.kinds" :key="g.key" class="mini">
            <span>{{ g.label }} <small>{{ g.n }}</small></span>
            <div class="g-bar"><div :style="{ width: (g.avg / 5) * 100 + '%' }" /><span>{{ fmtAvg(g.avg) }}</span></div>
          </div>
        </div>
        <div class="card">
          <h2>Эпохи</h2>
          <div v-for="g in [...p.decades].sort((a, b) => +a.key - +b.key)" :key="g.key" class="mini">
            <span>{{ g.label }} <small>{{ g.n }}</small></span>
            <div class="g-bar"><div :style="{ width: (g.avg / 5) * 100 + '%' }" /><span>{{ fmtAvg(g.avg) }}</span></div>
          </div>
        </div>
      </div>

      <div v-if="p.mine.n && p.recs.n" class="card recs">
        <h2>Как зашли рекомендации</h2>
        <p>
          Фильмы из исходного списка Xias — в среднем <b>{{ fmtAvg(p.mine.avg) }}</b> ({{ p.mine.n }} шт.),
          добавленные по его вкусу — <b>{{ fmtAvg(p.recs.avg) }}</b> ({{ p.recs.n }} шт.).
          {{ p.recs.avg >= p.mine.avg - 0.3 ? 'Подбор попал в цель.' : 'Исходный список всё-таки роднее.' }}
        </p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.stats { display: flex; flex-direction: column; gap: 16px; }
.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 16px; }
h2 { margin: 0 0 14px; font: 700 22px/1.2 var(--font-display); }
.sub, .foot { color: var(--muted); font-size: 13px; margin: -6px 0 14px; line-height: 1.5; }
.foot { margin: 16px 0 0; }
.empty { text-align: center; padding: 40px 20px; }
.empty p { color: var(--text-2); }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
.tile { background: var(--surface); border: 0; box-shadow: inset 0 0 0 1px var(--line); border-radius: 18px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
.tile span { font: 600 13px var(--font-body); letter-spacing: 0.02em; color: var(--accent); }
.tile b { font: 700 21px/1.15 var(--font-display); }
.tile small { color: var(--muted); font-weight: 600; }
.dist { display: flex; gap: 2px; height: 34px; border-radius: 10px; overflow: hidden; }
.seg { display: grid; place-items: center; min-width: 4px; font: 800 12px var(--font-body); color: var(--on-tier); background: var(--tc); flex-basis: 0; }
.seg[data-tier='S'] { --tc: var(--t-s); }
.seg[data-tier='A'] { --tc: var(--t-a); }
.seg[data-tier='B'] { --tc: var(--t-b); }
.seg[data-tier='C'] { --tc: var(--t-c); }
.seg[data-tier='D'] { --tc: var(--t-d); }
.seg[data-tier='X'] { --tc: var(--t-x); color: var(--text); }
.genres { display: flex; flex-direction: column; gap: 10px; }
.g { display: grid; grid-template-columns: 170px minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 6px 0; border-bottom: 1px dashed var(--line); }
.g:last-child { border: 0; }
.g-name { display: flex; flex-direction: column; }
.g-name small { color: var(--muted); font-weight: 600; }
.g-bar { position: relative; height: 10px; background: var(--bg-2); border-radius: 999px; display: flex; align-items: center; }
.g-bar div { height: 100%; border-radius: 999px; background: var(--accent); }
.g-bar span { position: absolute; right: 0; top: -20px; font-size: 12px; font-weight: 800; color: var(--text-2); }
.g-best { --card-w: 38px; display: flex; gap: 4px; cursor: pointer; min-width: 164px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.mini { display: grid; grid-template-columns: 130px 1fr; gap: 12px; align-items: center; margin-top: 16px; }
.mini small { color: var(--muted); font-weight: 700; margin-left: 4px; }
.recs p { margin: 0; color: var(--text-2); line-height: 1.6; }
.recs b { color: var(--accent); }
@media (max-width: 860px) {
  .hero, .two { grid-template-columns: 1fr; }
  .g { grid-template-columns: 1fr; gap: 6px; }
  .g-bar span { top: -18px; }
}
</style>
