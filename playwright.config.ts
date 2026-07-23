import { defineConfig } from '@playwright/test'
import path from 'node:path'

const configDir = path.dirname(new URL(import.meta.url).pathname)

function positiveInteger(value: string | undefined) {
  if (!value) return undefined

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  workers: positiveInteger(process.env.PLAYWRIGHT_WORKERS) ?? 2,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:3002',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm exec next build && pnpm exec next start --port 3002',
    cwd: configDir,
    url: 'http://127.0.0.1:3002',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
