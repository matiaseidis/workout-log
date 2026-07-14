interface Props {
  value: number
  decimal?: boolean
  label: string
  onCommit: (v: number) => void
}

/**
 * Numeric input tuned for the gym: right keyboard on iOS, select-all on focus
 * for fast overwrite, commits on change/blur, rejects garbage.
 */
export function NumberField({ value, decimal, label, onCommit }: Props) {
  return (
    <input
      class="num"
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      key={value}
      defaultValue={String(value)}
      aria-label={label}
      onFocus={(e) => (e.currentTarget as HTMLInputElement).select()}
      onChange={(e) => {
        const el = e.currentTarget as HTMLInputElement
        const v = parseFloat(el.value.replace(',', '.'))
        if (Number.isFinite(v) && v >= 0) onCommit(v)
        else el.value = String(value)
      }}
    />
  )
}
