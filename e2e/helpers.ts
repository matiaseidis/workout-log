import { expect, type Page } from '@playwright/test'

/** Complete the first-run profile setup. Assumes a fresh (empty-storage) context. */
export async function firstRunSetup(page: Page, name = 'Ana') {
  await page.goto('./')
  await page.getByLabel('Your name').fill(name)
  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page.getByText('Workouts', { exact: true })).toBeVisible()
}

export interface SeedRow {
  name: string
  sets: number
  reps: number
  weight: number
}

/** Commit a NumberField: fill then blur (the field commits on change). */
export async function fillNumber(field: ReturnType<Page['locator']>, value: number | string) {
  await field.fill(String(value))
  await field.blur()
}

export async function createRoutine(page: Page, name: string, rows: SeedRow[]) {
  await page.getByRole('button', { name: 'New routine' }).click()
  await page.getByLabel('Name', { exact: true }).fill(name)
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) await page.getByRole('button', { name: 'add exercise' }).click()
    const row = page.locator('.seedrow').nth(i)
    await row.getByLabel('Exercise name').fill(rows[i].name)
    await fillNumber(row.getByLabel('sets'), rows[i].sets)
    await fillNumber(row.getByLabel('reps'), rows[i].reps)
    await fillNumber(row.getByLabel('weight kg'), rows[i].weight)
  }
  await page.getByRole('button', { name: 'Save routine' }).click()
  await expect(page.locator('.rtcard .hit', { hasText: name })).toBeVisible()
}

export function routineCard(page: Page, name: string) {
  return page.locator('.rtcard .hit', { hasText: name })
}

export function exercise(page: Page, index: number) {
  return page.locator('.exercise').nth(index)
}

/** Check off every set of every exercise in the active session. */
export async function checkAllSets(page: Page) {
  const checks = page.locator('.check')
  const n = await checks.count()
  for (let i = 0; i < n; i++) await checks.nth(i).click()
}

export async function markDone(page: Page) {
  await page.getByRole('button', { name: 'Mark workout done' }).click()
  await expect(page.getByText('Session is frozen')).toBeVisible()
}

export async function backToWorkouts(page: Page) {
  await page.getByRole('button', { name: 'Back to workouts' }).click()
  await expect(page.getByText('Workouts', { exact: true })).toBeVisible()
}

/** Full happy-path workout: start from home, check all sets, finish, return home. */
export async function completeWorkout(page: Page, routineName: string) {
  await routineCard(page, routineName).click()
  await expect(page.getByText('live session')).toBeVisible()
  await checkAllSets(page)
  await markDone(page)
  await backToWorkouts(page)
}
