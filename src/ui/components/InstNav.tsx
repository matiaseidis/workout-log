import type { ComponentChildren } from 'preact'

interface Props {
  onPrev?: () => void
  onNext?: () => void
  warn?: boolean
  children: ComponentChildren
}

/** ◀ label ▶ — navigation between instances of the same workout. */
export function InstNav({ onPrev, onNext, warn, children }: Props) {
  return (
    <div class={`instnav ${warn ? 'warn' : ''}`}>
      <button onClick={onPrev} disabled={!onPrev} aria-label="Previous instance">
        ◀
      </button>
      <span class="where">{children}</span>
      <button onClick={onNext} disabled={!onNext} aria-label="Next instance">
        ▶
      </button>
    </div>
  )
}
