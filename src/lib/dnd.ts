// Перетаскивание между тирами и каталогом.
// Принцип: на отпускании делаем минимум синхронной работы — двигаем id в реактивном state
// (Vue перерисует только два затронутых списка в том же кадре), всё остальное — в фоне.
import Sortable from 'sortablejs'
import type { TierKey } from '../data/meta'
import { move } from './store'

let next: Node | null = null
let lastDrop = 0
export const justDropped = () => Date.now() - lastDrop < 250

export function makeSortable(el: HTMLElement, list: TierKey | 'pool') {
  const isPool = list === 'pool'
  return Sortable.create(el, {
    group: 'tiers',
    sort: !isPool,
    // в каталоге анимацию отключаем: Sortable замерял бы позиции всех ~700 карточек
    animation: isPool ? 0 : 150,
    easing: 'cubic-bezier(.2,.8,.2,1)',
    draggable: '.poster',
    forceFallback: true, // свой «призрак» без системной анимации возврата
    fallbackOnBody: true,
    fallbackTolerance: 4,
    delay: 140,
    delayOnTouchOnly: true,
    scroll: true,
    bubbleScroll: true,
    scrollSensitivity: 90,
    scrollSpeed: 14,
    ghostClass: 'drag-ghost',
    chosenClass: 'drag-chosen',
    fallbackClass: 'drag-float',
    onStart(e) {
      next = e.item.nextSibling
    },
    onEnd(e) {
      lastDrop = Date.now()
      const id = e.item.dataset.id!
      const to = (e.to as HTMLElement).dataset.list as TierKey | 'pool'
      const from = (e.from as HTMLElement).dataset.list as TierKey | 'pool'
      const idx = e.newDraggableIndex ?? e.newIndex ?? 0
      if (to === from && e.oldDraggableIndex === idx) return
      // возвращаем DOM как был — дальше его ведёт Vue, без рассинхрона
      e.item.remove()
      e.from.insertBefore(e.item, next)
      if (to === 'pool') { if (from !== 'pool') move(id, null) }
      else move(id, to, idx)
    },
  })
}
