<script setup lang="ts">
import type { AxisResult } from '../lib/analysis'

// a — основной профиль, b — опционально второй (сравнение)
defineProps<{ a: AxisResult[]; b?: AxisResult[]; nameA?: string; nameB?: string }>()
const pos = (x: AxisResult) => 100 - x.leftPct
const fill = (x: AxisResult) => ({ left: Math.min(50, pos(x)) + '%', width: Math.abs(50 - pos(x)) + '%' })
const side = (x: AxisResult) => (x.leftPct >= 50 ? { pct: x.leftPct, name: x.axis.left.name } : { pct: 100 - x.leftPct, name: x.axis.right.name })
</script>

<template>
  <div class="axes">
    <div v-if="b" class="legend">
      <span><i class="dot a" />{{ nameA }}</span>
      <span><i class="dot b" />{{ nameB }}</span>
    </div>
    <div v-for="(x, i) in a" :key="x.axis.key" class="axis">
      <div class="head">
        <span class="t">{{ x.axis.title }}</span>
        <span class="v">
          <b class="ca">{{ side(x).pct }}% {{ side(x).name }}</b>
          <template v-if="b"> · <b class="cb">{{ side(b[i]).pct }}% {{ side(b[i]).name }}</b></template>
        </span>
      </div>
      <div class="track" :title="`${x.axis.left.name} ${x.leftPct}% / ${x.axis.right.name} ${100 - x.leftPct}%`">
        <div class="fill" :style="fill(x)" />
        <div class="mark a" :style="{ left: pos(x) + '%' }" />
        <div v-if="b" class="mark b" :style="{ left: pos(b[i]) + '%' }" :title="`${nameB}: ${b[i].axis.left.name} ${b[i].leftPct}%`" />
        <div class="mid" />
      </div>
      <div class="poles">
        <span>{{ x.axis.left.l }} · {{ x.axis.left.name }}</span>
        <span>{{ x.axis.right.name }} · {{ x.axis.right.l }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.axes { display: flex; flex-direction: column; gap: 18px; }
.legend { display: flex; gap: 16px; font-size: 13px; font-weight: 700; color: var(--text-2); }
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: -1px; }
.dot.a { background: var(--accent); }
.dot.b { background: var(--sage); }
.head { display: flex; justify-content: space-between; gap: 10px; font-size: 14px; margin-bottom: 6px; flex-wrap: wrap; }
.t { font: 700 15px var(--font-display); }
.v { color: var(--text-2); }
.ca { color: var(--accent); }
.cb { color: var(--sage); }
.track { position: relative; height: 12px; border-radius: 999px; background: var(--bg-2); border: 1px solid var(--line); }
.fill { position: absolute; top: 0; bottom: 0; border-radius: 999px; background: color-mix(in oklab, var(--accent) 45%, transparent); }
.mid { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 1px; background: var(--muted); opacity: 0.35; }
.mark {
  position: absolute; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%;
  border: 2px solid var(--panel);
  z-index: 1;
}
.mark.a { background: var(--accent); }
.mark.b { background: var(--sage); width: 14px; height: 14px; margin: -7px 0 0 -7px; }
.poles { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); margin-top: 6px; font-weight: 600; }
</style>
