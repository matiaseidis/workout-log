import { expect, test, type Page } from '@playwright/test'
import { installDriveMock, newDriveState, sessionFiles, type DriveState } from './drive-mock'
import { completeWorkout, createRoutine, exercise, fillNumber, firstRunSetup, routineCard } from './helpers'

// Block service workers so every request (incl. Drive) goes through the route mocks.
test.use({ serviceWorkers: 'block' })

const PUSH = [
  { name: 'Bench Press', sets: 2, reps: 8, weight: 60 },
  { name: 'Overhead Press', sets: 2, reps: 10, weight: 30 },
]

function todayStr(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

async function connectDrive(page: Page) {
  await page.getByRole('button', { name: 'set up sync' }).click()
  await page.getByRole('button', { name: 'Connect Google Drive' }).click()
  await expect(page.getByText('Connected')).toBeVisible()
  await page.getByRole('button', { name: '‹ Back' }).click()
}

const badge = (page: Page, text: string | RegExp) => page.locator('.pill', { hasText: text })

let state: DriveState
test.beforeEach(async ({ context }) => {
  state = newDriveState()
  await installDriveMock(context, state)
})

test.describe('drive sync robustness', () => {
  test('remote snapshot is append-only: one write-once CSV per session, never modified', async ({ page }) => {
    await firstRunSetup(page)
    await createRoutine(page, 'Push Day', PUSH)
    await completeWorkout(page, 'Push Day')
    await connectDrive(page)
    await expect(badge(page, '✓ synced')).toBeVisible()

    // exactly one CSV, in WorkoutTracker/push-day/<date>.csv, with the right content
    expect(sessionFiles(state)).toHaveLength(1)
    const file = sessionFiles(state)[0]
    expect(file.name).toBe(`${todayStr()}.csv`)
    const routineFolder = state.files.get(file.parents[0])!
    expect(routineFolder.name).toBe('push-day')
    expect(state.files.get(routineFolder.parents[0])!.name).toBe('WorkoutTracker')
    expect(file.content).toContain('session_id,routine,routine_slug')
    expect(file.content).toContain('Bench Press')
    expect(file.appProperties?.sessionId).toBeTruthy()
    expect(state.uploads).toBe(1)

    // re-syncing must not re-upload, modify or delete anything
    await badge(page, '✓ synced').click()
    await expect(badge(page, '✓ synced')).toBeVisible()
    expect(state.uploads).toBe(1)
    expect(state.mutations).toBe(0)
    expect(file.content).toBe(sessionFiles(state)[0].content)
  })

  test('temporal: workout finished while Drive is unreachable uploads on the next trigger', async ({ page }) => {
    await firstRunSetup(page)
    await createRoutine(page, 'Push Day', PUSH)
    await connectDrive(page)
    await expect(badge(page, '✓ synced')).toBeVisible()

    state.offline = true
    await completeWorkout(page, 'Push Day')
    await expect(badge(page, '1 pending')).toBeVisible()
    expect(sessionFiles(state)).toHaveLength(0)

    state.offline = false
    await page.evaluate(() => window.dispatchEvent(new Event('online'))) // the connectivity trigger
    await expect(badge(page, '✓ synced')).toBeVisible()
    expect(sessionFiles(state)).toHaveLength(1)
    expect(state.mutations).toBe(0)
  })

  test('temporal: mid-batch upload failure retries later without duplicates; same-day names get suffixed', async ({
    page,
  }) => {
    await firstRunSetup(page)
    await createRoutine(page, 'Push Day', PUSH)
    await completeWorkout(page, 'Push Day')
    await completeWorkout(page, 'Push Day') // same routine + date -> name collision path

    state.failUploads = 1
    await connectDrive(page)
    await expect(badge(page, '1 pending')).toBeVisible() // one landed, one failed
    expect(sessionFiles(state)).toHaveLength(1)

    await badge(page, '1 pending').click() // manual trigger = retry
    await expect(badge(page, '✓ synced')).toBeVisible()

    const files = sessionFiles(state)
    expect(files).toHaveLength(2)
    const ids = files.map((f) => f.appProperties!.sessionId)
    expect(new Set(ids).size).toBe(2) // no duplicate sessions on Drive
    expect(files.map((f) => f.name).sort()).toEqual([`${todayStr()}.csv`, `${todayStr()}_2.csv`])
    expect(state.mutations).toBe(0)
  })

  test('temporal: expired/revoked token surfaces reconnect, loses nothing, recovers on tap', async ({ page }) => {
    await firstRunSetup(page)
    await createRoutine(page, 'Push Day', PUSH)
    await completeWorkout(page, 'Push Day')
    await connectDrive(page)
    await expect(badge(page, '✓ synced')).toBeVisible()

    state.reject401 = true
    await completeWorkout(page, 'Push Day')
    await expect(badge(page, 'reconnect')).toBeVisible()

    // local data is fully intact while auth is broken
    await page.getByRole('button', { name: 'History' }).click()
    await expect(page.locator('.histrow')).toHaveCount(2)
    await page.getByRole('button', { name: 'Workouts' }).click()

    state.reject401 = false
    await badge(page, 'reconnect').click()
    await expect(badge(page, '✓ synced')).toBeVisible()
    expect(sessionFiles(state)).toHaveLength(2)
    expect(state.mutations).toBe(0)
  })

  test('durability: a wiped device restores full history and templates from Drive', async ({ page, browser }) => {
    // device 1: two workouts with a distinctive weight, synced
    await firstRunSetup(page)
    await createRoutine(page, 'Push Day', PUSH)
    await routineCard(page, 'Push Day').click()
    await fillNumber(exercise(page, 0).getByLabel('weight kg').first(), 77.5)
    await page.locator('.check').first().click()
    await page.getByRole('button', { name: 'Mark workout done' }).click()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('button', { name: 'Back to workouts' }).click()
    await completeWorkout(page, 'Push Day')
    await connectDrive(page)
    await expect(badge(page, '✓ synced')).toBeVisible()
    expect(sessionFiles(state)).toHaveLength(2)

    // device 2: brand-new profile, same Drive
    const context2 = await browser.newContext({ serviceWorkers: 'block' })
    await installDriveMock(context2, state)
    const page2 = await context2.newPage()
    await page2.goto('http://localhost:4173/workout-log/')
    await page2.getByLabel('Your name').fill('Ana')
    await page2.getByRole('button', { name: 'Get started' }).click()
    await expect(page2.getByText('No routines yet')).toBeVisible()

    await connectDrive(page2)
    await expect(badge(page2, '✓ synced')).toBeVisible()

    // history and routine restored; template pre-fills from the latest completed session
    await expect(routineCard(page2, 'Push Day')).toContainText('last done')
    await page2.getByRole('button', { name: 'History' }).click()
    await expect(page2.locator('.histrow')).toHaveCount(2)
    await page2.getByRole('button', { name: 'Workouts' }).click()
    await routineCard(page2, 'Push Day').click()
    await expect(page2.getByText('live session')).toBeVisible()
    await expect(exercise(page2, 0).getByLabel('weight kg').first()).toHaveValue('77.5')

    // restoring downloaded — it must not have re-uploaded or mutated anything
    expect(sessionFiles(state)).toHaveLength(2)
    expect(state.mutations).toBe(0)
    await context2.close()
  })
})
