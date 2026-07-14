import { expect, test } from '@playwright/test'
import {
  backToWorkouts,
  checkAllSets,
  completeWorkout,
  createRoutine,
  exercise,
  fillNumber,
  firstRunSetup,
  markDone,
  routineCard,
} from './helpers'

const PUSH = [
  { name: 'Bench Press', sets: 2, reps: 8, weight: 60 },
  { name: 'Overhead Press', sets: 2, reps: 10, weight: 30 },
]

test.describe('empty state → validated state', () => {
  test('first run: profile setup, routine creation, first workout end to end', async ({ page }) => {
    await page.goto('./')

    // First run shows profile setup; the start button demands a name.
    await expect(page.getByText('Workout Log')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Get started' })).toBeDisabled()
    await page.getByLabel('Your name').fill('Ana')
    await page.getByRole('button', { name: 'Get started' }).click()

    // Home: greeted by name, empty state.
    await expect(page.getByText('Ana')).toBeVisible()
    await expect(page.getByText('No routines yet')).toBeVisible()

    await createRoutine(page, 'Push Day', PUSH)
    await expect(routineCard(page, 'Push Day')).toContainText('never done · 2 exercises')

    // Start the workout: seeded values are pre-filled.
    await routineCard(page, 'Push Day').click()
    await expect(page.getByText('live session')).toBeVisible()
    const bench = exercise(page, 0)
    await expect(bench.locator('input.exname')).toHaveValue('Bench Press')
    await expect(bench.getByLabel('reps').first()).toHaveValue('8')
    await expect(bench.getByLabel('weight kg').first()).toHaveValue('60')

    // Done is gated on having checked at least one set.
    await expect(page.getByRole('button', { name: 'Mark workout done' })).toBeDisabled()

    // Lift: bump bench weight, add a set, check everything off.
    await fillNumber(bench.getByLabel('weight kg').first(), 62.5)
    await bench.getByRole('button', { name: 'add set' }).click()
    await expect(bench.locator('.setrow')).toHaveCount(3)
    await checkAllSets(page)
    await markDone(page)

    // Summary: 2 exercises, 5 sets (3 bench + 2 OHP), frozen.
    await expect(page.getByText('2 exercises · 5 sets')).toBeVisible()
    await expect(page.getByText('8 × 62.5 kg top set')).toBeVisible()
    await backToWorkouts(page)
    await expect(routineCard(page, 'Push Day')).toContainText('last done')
  })

  test('copy-forward: next session starts from what was actually done', async ({ page }) => {
    await firstRunSetup(page)
    await createRoutine(page, 'Push Day', PUSH)

    // Session 1: bench done at 65 kg with an extra exercise; OHP left entirely unchecked.
    await routineCard(page, 'Push Day').click()
    const bench = exercise(page, 0)
    await fillNumber(bench.getByLabel('weight kg').first(), 65)
    await bench.locator('.check').first().click()
    await bench.locator('.check').nth(1).click()
    await page.getByRole('button', { name: 'add exercise' }).click()
    const added = exercise(page, 2)
    await added.locator('input.exname').fill('Cable Fly')
    await added.locator('input.exname').blur()
    await added.locator('.check').first().click()
    await markDone(page)
    await backToWorkouts(page)

    // Session 2 template = session 1 outcome: no OHP, bench at 65, Cable Fly present.
    await routineCard(page, 'Push Day').click()
    await expect(page.locator('.exercise')).toHaveCount(2)
    await expect(exercise(page, 0).locator('input.exname')).toHaveValue('Bench Press')
    await expect(exercise(page, 0).getByLabel('weight kg').first()).toHaveValue('65')
    await expect(exercise(page, 1).locator('input.exname')).toHaveValue('Cable Fly')
    // and nothing is pre-checked
    await expect(page.locator('.check.on')).toHaveCount(0)
  })

  test('typing a multi-digit number keeps focus and commits on blur', async ({ page }) => {
    await firstRunSetup(page)
    await createRoutine(page, 'Push Day', PUSH)
    await routineCard(page, 'Push Day').click()

    const reps = exercise(page, 0).getByLabel('reps').first()
    await reps.click() // focus (select-all)
    await reps.pressSequentially('12') // real keystrokes, digit by digit
    await expect(reps).toBeFocused() // focus must survive every keystroke
    await expect(reps).toHaveValue('12')
    await reps.blur()

    // committed to the DB: survives a reload + resume
    await page.goto('./')
    await page.reload()
    await page.getByRole('button', { name: 'Resume' }).click()
    await expect(exercise(page, 0).getByLabel('reps').first()).toHaveValue('12')
  })

  test('in-progress workout survives reload; resume and discard both work', async ({ page }) => {
    await firstRunSetup(page)
    await createRoutine(page, 'Legs', [{ name: 'Back Squat', sets: 2, reps: 6, weight: 80 }])

    await routineCard(page, 'Legs').click()
    const squat = exercise(page, 0)
    await fillNumber(squat.getByLabel('weight kg').first(), 82.5)
    await squat.locator('.check').first().click()
    await expect(squat.locator('.check.on')).toHaveCount(1) // write confirmed before we navigate

    // Durability: reload lands on home with a resume banner; the edit survived.
    await page.goto('./')
    await page.reload()
    await expect(page.getByText('Legs — in progress')).toBeVisible()
    await page.getByRole('button', { name: 'Resume' }).click()
    await expect(exercise(page, 0).getByLabel('weight kg').first()).toHaveValue('82.5')
    await expect(exercise(page, 0).locator('.check.on')).toHaveCount(1)

    // Starting another routine is blocked while one is in progress.
    await page.getByRole('button', { name: '‹ Back' }).click()
    await createRoutine(page, 'Pull Day', [{ name: 'Deadlift', sets: 1, reps: 5, weight: 100 }])
    await expect(routineCard(page, 'Pull Day')).toBeDisabled()

    // Discard clears it and unblocks.
    page.on('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'Discard', exact: true }).click()
    await expect(page.getByText('Legs — in progress')).not.toBeVisible()
    await expect(routineCard(page, 'Pull Day')).toBeEnabled()
  })

  test('peek: browse previous instances read-only and return to the live session', async ({ page }) => {
    await firstRunSetup(page)
    await createRoutine(page, 'Push Day', PUSH)
    await completeWorkout(page, 'Push Day')
    await completeWorkout(page, 'Push Day')

    await routineCard(page, 'Push Day').click()
    await expect(page.getByText('live session')).toBeVisible()
    await page.getByRole('button', { name: 'Previous instance' }).click()

    // Read-only view: warning banner, no inputs, no checkboxes.
    await expect(page.getByText('— read only')).toBeVisible()
    await expect(page.locator('input.num')).toHaveCount(0)
    await expect(page.locator('.check')).toHaveCount(0)

    // Walk back to the older instance, then forward again to the live session.
    await page.getByRole('button', { name: 'Previous instance' }).click()
    await expect(page.getByRole('button', { name: 'Previous instance' })).toBeDisabled()
    await page.getByRole('button', { name: 'Next instance' }).click()
    await page.getByRole('button', { name: 'Next instance' }).click()
    await expect(page.getByText('live session')).toBeVisible()

    // The shortcut button also returns to the live session.
    await page.getByRole('button', { name: 'Previous instance' }).click()
    await page.getByRole('button', { name: 'Back to today’s workout' }).click()
    await expect(page.getByText('live session')).toBeVisible()
  })

  test('history: completed sessions listed per routine, detail is frozen, ◀ ▶ navigates', async ({ page }) => {
    await firstRunSetup(page)
    await createRoutine(page, 'Push Day', PUSH)
    await completeWorkout(page, 'Push Day')
    await completeWorkout(page, 'Push Day')

    await page.getByRole('button', { name: 'History' }).click()
    await expect(page.locator('.histrow')).toHaveCount(2)
    await page.locator('.histrow').first().click()

    await expect(page.getByText('frozen')).toBeVisible()
    await expect(page.locator('input.num')).toHaveCount(0) // immutable: nothing editable
    await expect(page.getByRole('button', { name: 'Next instance' })).toBeDisabled() // newest
    await page.getByRole('button', { name: 'Previous instance' }).click()
    await expect(page.getByRole('button', { name: 'Previous instance' })).toBeDisabled() // oldest of 2
    await page.getByRole('button', { name: 'History', exact: false }).first().click()
    await expect(page.locator('.histrow')).toHaveCount(2)
  })

  test('charts: progress renders after two completed sessions', async ({ page }) => {
    await firstRunSetup(page)
    await createRoutine(page, 'Push Day', PUSH)
    await completeWorkout(page, 'Push Day')
    await completeWorkout(page, 'Push Day')

    await page.getByRole('button', { name: 'Progress' }).click()
    await expect(page.getByText('top set weight (kg)')).toBeVisible()
    await expect(page.locator('.chartbox svg')).toBeVisible()
    // one dot per completed session
    await expect(page.locator('.chartbox svg circle')).toHaveCount(2)
  })

  test('offline: app loads and a full workout can be completed with no network', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'service-worker + offline toggling is flaky in Playwright WebKit')

    await firstRunSetup(page)
    await createRoutine(page, 'Push Day', PUSH)
    await completeWorkout(page, 'Push Day')

    // Ensure the service worker controls the page before cutting the network.
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
    await page.context().setOffline(true)
    await page.reload()

    // App shell served from cache; local data intact; full workout possible.
    await expect(routineCard(page, 'Push Day')).toContainText('last done')
    await completeWorkout(page, 'Push Day')
    await page.getByRole('button', { name: 'History' }).click()
    await expect(page.locator('.histrow')).toHaveCount(2)
    await page.context().setOffline(false)
  })
})
