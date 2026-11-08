<script setup lang="ts">
// Скролл без видимого скроллбара: края растворяются, когда дальше есть контент,
// а тонкая неоновая нить показывает позицию только во время прокрутки или у края.
import { onBeforeUnmount, onMounted, ref } from 'vue'

const vp = ref<HTMLElement | null>(null)
const top = ref(false)
const bottom = ref(false)
const active = ref(false)
const thumb = ref({ h: 0, y: 0, show: false })
let hideT = 0
let ro: ResizeObserver | null = null

function measure() {
  const el = vp.value
  if (!el) return
  const { scrollTop, scrollHeight, clientHeight } = el
  const can = scrollHeight > clientHeight + 2
  top.value = scrollTop > 4
  bottom.value = can && scrollTop + clientHeight < scrollHeight - 4
  const h = Math.max(36, (clientHeight / scrollHeight) * clientHeight)
  const y = can ? (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - h) : 0
  thumb.value = { h, y, show: can }
}
function onScroll() {
  measure()
  active.value = true
  clearTimeout(hideT)
  hideT = window.setTimeout(() => (active.value = false), 900)
}

// перетаскивание нити
function grab(e: PointerEvent) {
  const el = vp.value
  if (!el) return
  e.preventDefault()
  const t = e.currentTarget as HTMLElement
  t.setPointerCapture(e.pointerId)
  const startY = e.clientY
  const startTop = el.scrollTop
  const ratio = (el.scrollHeight - el.clientHeight) / Math.max(1, el.clientHeight - thumb.value.h)
  const mv = (ev: PointerEvent) => { el.scrollTop = startTop + (ev.clientY - startY) * ratio }
  const upFn = () => { t.removeEventListener('pointermove', mv); t.removeEventListener('pointerup', upFn) }
  t.addEventListener('pointermove', mv)
  t.addEventListener('pointerup', upFn)
}

onMounted(() => {
  measure()
  ro = new ResizeObserver(measure)
  if (vp.value) {
    ro.observe(vp.value)
    if (vp.value.firstElementChild) ro.observe(vp.value.firstElementChild)
  }
})
onBeforeUnmount(() => ro?.disconnect())
defineExpose({ vp })
</script>

<template>
  <div class="sa" :class="{ top, bottom, active }">
    <div ref="vp" class="sa-vp" @scroll.passive="onScroll"><slot /></div>
    <div v-if="thumb.show" class="sa-rail" @pointerdown="grab">
      <i :style="{ height: thumb.h + 'px', transform: `translateY(${thumb.y}px)` }" />
    </div>
  </div>
</template>

<style scoped>
.sa { position: relative; min-height: 0; display: flex; flex-direction: column; }
.sa-vp {
  flex: 1; min-height: 0;
  overflow-y: auto; overflow-x: hidden;
  scrollbar-width: none;
  overscroll-behavior: contain;
  --ft: 0px; --fb: 0px;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 var(--ft), #000 calc(100% - var(--fb)), transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0, #000 var(--ft), #000 calc(100% - var(--fb)), transparent 100%);
}
.sa-vp::-webkit-scrollbar { display: none; }
.sa.top .sa-vp { --ft: 28px; }
.sa.bottom .sa-vp { --fb: 44px; }
.sa-rail {
  position: absolute; top: 6px; bottom: 6px; right: 0;
  width: 14px;
  cursor: grab;
  z-index: 2;
}
.sa-rail i {
  position: absolute; top: 0; right: 4px;
  width: 3px; border-radius: 99px;
  background: linear-gradient(var(--accent-2), var(--accent));
  box-shadow: 0 0 10px var(--accent), 0 0 2px var(--accent-2);
  opacity: 0;
  transition: opacity 0.35s, width 0.15s;
}
.sa.active .sa-rail i, .sa-rail:hover i { opacity: 0.9; }
.sa-rail:hover i { width: 5px; right: 3px; }
@media (hover: none) { .sa-rail { display: none; } }
</style>
