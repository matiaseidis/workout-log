/** Routine name -> Drive-safe folder slug, e.g. "Día de Piernas" -> "dia-de-piernas". */
export function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'routine'
}

/** Make a slug unique against the set of existing slugs by suffixing -2, -3, ... */
export function uniqueSlug(name: string, existing: Set<string>): string {
  const base = slugify(name)
  if (!existing.has(base)) return base
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`
    if (!existing.has(candidate)) return candidate
  }
}
