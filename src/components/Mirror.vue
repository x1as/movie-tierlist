<script setup lang="ts">
import { computed, ref } from 'vue'
import Poster from './Poster.vue'
import TypeCard from './TypeCard.vue'
import AxisBars from './AxisBars.vue'
import { compare, matchTitle } from '../lib/analysis'
import { decode, encode, type Snapshot } from '../lib/codec'
import { XIAS } from '../data/xias'
import { snapshot } from '../lib/store'
import { TIERS, RANKED } from '../data/meta'

const emit = defineEmits<{ open: [id: string] }>()
const HIST = 'lamp-tierlist.mirror'

const base = ref<'xias' | 'local'>(XIAS ? 'xias' : 'local')
const input = ref('')
const err = ref('')
const friend = ref<Snapshot | null>(null)
const history = ref<{ name: string; code: string; at: string }[]>(load())

function load() { try { return JSON.parse(localStorage.getItem(HIST) || '[]') } catch { return [] } }
function save() { try { localStorage.setItem(HIST, JSON.stringify(history.value.slice(0, 20))) } catch {} }

const baseSnap = computed<Snapshot>(() => (base.value === 'xias' && XIAS ? XIAS : snapshot()))
const baseName = computed(() => (base.value === 'xias' ? 'Xias' : baseSnap.value.name || 'Я'))
const r = computed(() => (friend.value ? compare(baseSnap.value.tiers, friend.value.tiers) : null))
const fname = computed(() => friend.value?.name || 'Гость')

async function run(text = input.value) {
  err.value = ''
  try {
    const s = await decode(text)
    friend.value = s
    const code = await encode(s)
    history.value = [{ name: s.name || 'Гость', code, at: new Date().toLocaleDateString('ru') }, ...history.value.filter((h) => h.code !== code)]
    save()
    requestAnimationFrame(() => document.getElementById('result')?.scrollIntoView({ behavior: 'smooth' }))
  } catch (e: any) { err.value = e?.message || 'Не получилось прочитать' }
}
async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) { input.value = await f.text(); run() }
}
function forget(code: string) { history.value = history.value.filter((h) => h.code !== code); save() }

const ring = computed(() => {
  const p = r.value?.match ?? 0
  const C = 2 * Math.PI * 70
  return { dash: `${(C * p) / 100} ${C}` }
})
const tierOf = (s: number) => RANKED.find((k) => TIERS[k].score === s) ?? ''
const fmt = (x: number) => x.toFixed(1).replace('.', ',')
const pick = (e: MouseEvent) => { const id = (e.target as HTMLElement).closest('.poster')?.getAttribute('data-id'); if (id) emit('open', id) }
</script>

<template>
  <section class="mirror">
    <div class="card intro">
      <p class="eyebrow">секретная комната</p>
      <h1>Кино-зеркало</h1>
      <p class="lead">Вставь код, который тебе прислали, и посмотри, насколько ваши вкусы совпадают.</p>

      <div class="base">
        <span>Сравнивать с:</span>
        <label :class="{ on: base === 'xias', off: !XIAS }"><input v-model="base" type="radio" value="xias" :disabled="!XIAS" /> встроенным списком Xias<small v-if="!XIAS"> (ещё не загружен)</small></label>
        <label :class="{ on: base === 'local' }"><input v-model="base" type="radio" value="local" /> тирлистом в этом браузере</label>
      </div>

      <textarea v-model="input" rows="4" placeholder="KT1.… или содержимое .json" />
      <div class="row">
        <button class="btn" :disabled="!input.trim()" @click="run()">Сравнить</button>
        <label class="ghost file">Файл .json<input type="file" accept=".json,.txt,application/json" @change="onFile" /></label>
      </div>
      <p v-if="err" class="err">{{ err }}</p>

      <div v-if="history.length" class="hist">
        <span>Уже сравнивал:</span>
        <span v-for="h in history" :key="h.code" class="h">
          <button @click="run(h.code)">{{ h.name }} <small>{{ h.at }}</small></button><i title="Забыть" @click="forget(h.code)">×</i>
        </span>
      </div>
    </div>

    <template v-if="r && friend">
      <div id="result" class="card match">
        <svg viewBox="0 0 160 160" class="ring" role="img" :aria-label="`Совпадение ${r.match}%`">
          <circle cx="80" cy="80" r="70" class="bg" />
          <circle cx="80" cy="80" r="70" class="fg" :stroke-dasharray="ring.dash" />
          <text x="80" y="78" text-anchor="middle" class="pct">{{ r.match }}%</text>
          <text x="80" y="102" text-anchor="middle" class="cap">совпадение</text>
        </svg>
        <div>
          <p class="eyebrow">{{ baseName }} × {{ fname }}</p>
          <h2>{{ matchTitle(r.match) }}</h2>
          <p class="lead">
            Общих оценённых фильмов: <b>{{ r.common }}</b>, в один и тот же тир — <b>{{ r.exact }}</b>.
            <template v-if="r.common < 10"> Пересечение маленькое, поэтому процент больше опирается на шкалы вкуса.</template>
          </p>
        </div>
      </div>

      <div class="types">
        <TypeCard :p="r.pa" :who="baseName" tone="a" />
        <TypeCard :p="r.pb" :who="fname" tone="b" />
      </div>

      <div class="card">
        <h2>Шкалы рядом</h2>
        <AxisBars :a="r.pa.ax" :b="r.pb.ax" :name-a="baseName" :name-b="fname" />
      </div>

      <div v-if="r.genres.length" class="card">
        <h2>Жанры: где вы расходитесь</h2>
        <p class="sub">Средний тир по жанру. Сверху — самые спорные.</p>
        <div class="legend"><span><i class="dot a" />{{ baseName }}</span><span><i class="dot b" />{{ fname }}</span></div>
        <div v-for="g in r.genres" :key="g.key" class="gd" :title="`${g.label}: ${baseName} ${fmt(g.a)} (${g.na}) · ${fname} ${fmt(g.b)} (${g.nb})`">
          <b>{{ g.label }}</b>
          <div class="bars">
            <div class="bar"><div class="a" :style="{ width: (g.a / 5) * 100 + '%' }" /><span>{{ fmt(g.a) }}</span></div>
            <div class="bar"><div class="b" :style="{ width: (g.b / 5) * 100 + '%' }" /><span>{{ fmt(g.b) }}</span></div>
          </div>
        </div>
      </div>

      <div v-if="r.bothLove.length" class="card">
        <h2>Общая любовь <small>{{ r.bothLove.length }}</small></h2>
        <div class="posters" @click="pick">
          <div v-for="x in r.bothLove.slice(0, 24)" :key="x.id" class="pp">
            <Poster :id="x.id" />
            <span class="pair"><i data-c="a">{{ tierOf(x.a) }}</i><i data-c="b">{{ tierOf(x.b) }}</i></span>
          </div>
        </div>
      </div>

      <div v-if="r.fights.length" class="card">
        <h2>Горячие споры <small>{{ r.fights.length }}</small></h2>
        <p class="sub">Разница в два тира и больше — повод для разговора.</p>
        <div class="posters" @click="pick">
          <div v-for="x in r.fights.slice(0, 24)" :key="x.id" class="pp">
            <Poster :id="x.id" />
            <span class="pair"><i data-c="a">{{ tierOf(x.a) }}</i><i data-c="b">{{ tierOf(x.b) }}</i></span>
          </div>
        </div>
      </div>

      <div class="two">
        <div v-if="r.forB.length" class="card">
          <h2>{{ fname }}, посмотри</h2>
          <p class="sub">У {{ baseName }} в S/A, а у тебя не оценено.</p>
          <div class="posters" @click="pick"><Poster v-for="id in r.forB.slice(0, 18)" :key="id" :id="id" /></div>
        </div>
        <div v-if="r.forA.length" class="card">
          <h2>{{ baseName }}, посмотри</h2>
          <p class="sub">У {{ fname }} в S/A, а у тебя не оценено.</p>
          <div class="posters" @click="pick"><Poster v-for="id in r.forA.slice(0, 18)" :key="id" :id="id" /></div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.mirror { display: flex; flex-direction: column; gap: 16px; }
.eyebrow { margin: 0; font: 600 13px var(--font-body); letter-spacing: 0.02em; color: var(--accent); }
h1 { margin: 0 0 6px; font: 700 40px/1.1 var(--font-display); }
h2 { margin: 0 0 14px; font: 700 22px/1.2 var(--font-display); }
h2 small { font: 700 13px var(--font-body); color: var(--muted); margin-left: 6px; }
.lead { color: var(--text-2); line-height: 1.55; margin: 0 0 14px; }
.lead b { color: var(--text); }
.sub { color: var(--muted); font-size: 13px; margin: -6px 0 14px; }
.base { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; margin-bottom: 12px; font-weight: 700; font-size: 14px; color: var(--muted); }
.base label { display: flex; gap: 6px; align-items: center; color: var(--text-2); cursor: pointer; }
.base label.off { opacity: 0.5; cursor: not-allowed; }
.base input { accent-color: var(--accent); }
textarea { width: 100%; background: var(--bg-2); color: var(--text); border: 1px solid var(--line); border-radius: 10px; padding: 10px; font: 12px/1.4 ui-monospace, Consolas, monospace; resize: vertical; word-break: break-all; }
.row { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.file { position: relative; overflow: hidden; }
.file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.err { color: var(--t-s); font-weight: 700; }
.hist { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 14px; font-size: 13px; color: var(--muted); font-weight: 700; }
.h { display: inline-flex; align-items: center; background: var(--bg-2); border: 1px solid var(--line); border-radius: 999px; padding-right: 8px; }
.h button { background: none; border: 0; color: var(--text); font: 700 13px var(--font-body); padding: 5px 6px 5px 11px; cursor: pointer; }
.h small { color: var(--muted); }
.h i { font-style: normal; cursor: pointer; color: var(--muted); }
.match { display: grid; grid-template-columns: 170px 1fr; gap: 24px; align-items: center; }
.ring { width: 170px; height: 170px; transform: rotate(-90deg); }
.ring text { transform: rotate(90deg); transform-origin: 80px 80px; }
.ring .bg { fill: none; stroke: var(--bg-2); stroke-width: 12; }
.ring .fg { fill: none; stroke: var(--accent); stroke-width: 12; stroke-linecap: round; transition: stroke-dasharray 0.8s ease; }
.pct { font: 700 38px var(--font-display); fill: var(--text); }
.cap { font: 600 13px var(--font-body); fill: var(--muted); }
.match h2 { font-size: 30px; margin-bottom: 8px; }
.types, .two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.legend { display: flex; gap: 16px; font-size: 13px; font-weight: 700; color: var(--text-2); margin-bottom: 8px; }
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; }
.dot.a { background: var(--accent); }
.dot.b { background: var(--sage); }
.gd { display: grid; grid-template-columns: 170px 1fr; gap: 14px; align-items: center; padding: 8px 0; border-bottom: 1px dashed var(--line); }
.gd:last-child { border: 0; }
.bars { display: flex; flex-direction: column; gap: 4px; }
.bar { display: grid; grid-template-columns: 1fr 34px; gap: 8px; align-items: center; }
.bar div { height: 8px; border-radius: 999px; }
.bar .a { background: var(--accent); }
.bar .b { background: var(--sage); }
.bar span { font-size: 12px; font-weight: 800; color: var(--text-2); }
.posters { --card-w: 64px; display: flex; flex-wrap: wrap; gap: 8px; cursor: pointer; }
.pp { position: relative; }
.pair { position: absolute; left: 3px; right: 3px; bottom: 3px; display: flex; justify-content: space-between; }
.pair i { font: 800 11px/1 var(--font-body); font-style: normal; padding: 3px 5px; border-radius: 5px; color: var(--on-tier); }
.pair i[data-c='a'] { background: var(--accent); }
.pair i[data-c='b'] { background: var(--sage); }
@media (max-width: 760px) {
  h1 { font-size: 32px; }
  .match { grid-template-columns: 1fr; justify-items: center; text-align: center; }
  .types, .two { grid-template-columns: 1fr; }
  .gd { grid-template-columns: 1fr; gap: 6px; }
  .posters { --card-w: 56px; }
}
</style>
