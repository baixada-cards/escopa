import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const extraAllowedDevOrigins = (process.env.ESCOPA_ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    '127.0.0.1',
    'localhost',
    '**.ts.net',
    ...extraAllowedDevOrigins,
  ],
  devIndicators: {
    position: 'bottom-left',
  },
  turbopack: {
    root: dirname,
  },
}

export default nextConfig
