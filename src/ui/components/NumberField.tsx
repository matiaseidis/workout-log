import { useEffect, useRef } from 'preact/hooks'

interface Props {
  value: number
  decimal?: boolean
  label: string
  onCommit: (v: number) => void
}

/**
 * Numeric input tuned for the gym: right keyboard on iOS, select-all on focus
 * for fast overwrite. Commits on blur/Enter only — never re-renders or
 * remounts mid-edit, so focus stays put while typing multi-digit values.
 */
export function NumberField({ value, decimal, label, onCommit }: Props) {
  const ref = useRef<HTMLInputElement>(null)

  // Reflect external changes, but never while the user is editing this field.
  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el) el.value = String(value)
  }, [value])

  const commit = () => {
    const el = ref.current
    if (!el) return
    const v = parseFloat(el.value.replace(',', '.'))
    if (Number.isFinite(v) && v >= 0) {
      if (v !== value) onCommit(v)
      el.value = String(v)
    } else {
      el.value = String(value) // garbage in -> restore last good value
    }
  }

  return (
    <input
      ref={ref}
      class="num"
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      defaultValue={String(value)}
      aria-label={label}
      onFocus={(e) => {
        // Safari moves the caret on the click's mouseup, undoing a plain select();
        // re-select on the next frame and swallow the mouseup so select-all sticks.
        const el = e.currentTarget as HTMLInputElement
        el.select()
        requestAnimationFrame(() => el.select())
      }}
      onMouseUp={(e) => e.preventDefault()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
      }}
    />
  )
}
