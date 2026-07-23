import { expect, type Page, test } from '@playwright/test'

type EscopaLayoutSnapshot = {
  viewport: number
  width: number
  rootLeft: number
  rootRight: number
}

const ESCOPA_ROUTE = '/'

async function waitForEscopaSurface(page: Page) {
  const root = page.getByTestId('escopa-root')

  await expect(root).toBeVisible()
  await expect(page.getByTestId('escopa-table')).toBeVisible()
  await expect(page.getByTestId('escopa-hero-hand')).toBeVisible()
  await expect(page.getByTestId('escopa-villain-hand')).toBeVisible()
  await expect(page.getByTestId('escopa-deck-dock')).toBeVisible()
  await expect(page.getByTestId('escopa-side-you')).toBeVisible()
  await expect(page.getByTestId('escopa-side-villain')).toBeVisible()
}

async function expectNoHorizontalOverflow(page: Page) {
  const layout = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-testid="escopa-root"]')
    return {
      viewport: window.innerWidth,
      width: document.documentElement.scrollWidth,
      rootLeft: root?.getBoundingClientRect().left ?? 0,
      rootRight: root?.getBoundingClientRect().right ?? 0,
    } as EscopaLayoutSnapshot
  })

  expect(layout.width).toBeLessThanOrEqual(layout.viewport + 2)
  expect(layout.rootLeft).toBeGreaterThanOrEqual(-2)
  expect(layout.rootRight).toBeLessThanOrEqual(layout.viewport + 2)
}

async function clickPlayableCardIfAvailable(page: Page) {
  const enabledHandButton = page.locator('[data-testid="escopa-hero-hand"] .et-play-card:not([disabled])')
  const heroCards = page.locator('[data-testid="escopa-hero-hand"] .et-hand-card')
  const beforeCount = await heroCards.count()

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const enabledCount = await enabledHandButton.count()
    if (enabledCount > 0) {
      await expect(enabledHandButton.first()).toBeVisible()
      await enabledHandButton.first().click()
      await expect.poll(async () => {
        const afterCount = await heroCards.count()
        return afterCount < beforeCount
      }).toBeTruthy()
      return
    }

    await page.waitForTimeout(150)
  }

  throw new Error('Could not find an enabled Escopa play action during the test window.')
}

test('Escopa route mounts on desktop and supports playable interaction', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto(ESCOPA_ROUTE)

  await waitForEscopaSurface(page)
  await expect(page.getByTestId('escopa-table')).toContainText('You')
  await expectNoHorizontalOverflow(page)
  await expect(page.locator('[data-testid="escopa-hero-hand"] .et-play-card')).toHaveCount(3)

  await clickPlayableCardIfAvailable(page)

  await page.screenshot({
    path: testInfo.outputPath('escopa-desktop-playability.png'),
    fullPage: true,
  })
})

test.describe('compact Escopa on touch-sized viewport', () => {
  test.use({ hasTouch: true })

  test('Escopa mobile layout remains in bounds and keeps tappable controls', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(ESCOPA_ROUTE)

    await waitForEscopaSurface(page)
    await expectNoHorizontalOverflow(page)

    const heroCards = page.locator('[data-testid="escopa-hero-hand"] .et-hand-card')
    await expect(heroCards).toHaveCount(3)

    const playButtons = page.locator('[data-testid="escopa-hero-hand"] .et-play-card')
    await expect(playButtons).toHaveCount(3)

    const touchTarget = await playButtons.first().boundingBox()
    if (touchTarget == null) {
      throw new Error('Missing play button geometry on mobile layout test.')
    }
    expect(touchTarget.width).toBeGreaterThanOrEqual(28)
    expect(touchTarget.height).toBeGreaterThanOrEqual(28)

    const deckDock = page.getByTestId('escopa-deck-dock')
    await expect(deckDock).toBeVisible()

    const cycleButtons = page.locator('[data-testid="escopa-hero-hand"] .et-hand-cycle button')
    if (await cycleButtons.count() > 0) {
      const firstCycle = cycleButtons.first()
      const cycleBounds = await firstCycle.boundingBox()
      if (cycleBounds == null) {
        throw new Error('Missing capture-cycle geometry on mobile layout test.')
      }
      expect(cycleBounds.width).toBeGreaterThanOrEqual(24)
      expect(cycleBounds.height).toBeGreaterThanOrEqual(24)
    }

    await page.screenshot({
      path: testInfo.outputPath('escopa-mobile-playability.png'),
      fullPage: true,
    })
  })
})
