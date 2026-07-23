import { readFile, readdir } from 'node:fs/promises'

const dependencyLock = JSON.parse(await readFile('dependencies.lock.json', 'utf8'))
const packageManifest = JSON.parse(await readFile('package.json', 'utf8'))
const designSystem = dependencyLock.design_system
const expectedSpecifier =
  `git+${designSystem.repository}#${designSystem.commit}`

if (dependencyLock.format !== 'baixada-dependency-lock/v1') {
  throw new Error('unexpected dependency-lock format')
}
if (!/^[0-9a-f]{40}$/.test(designSystem.commit)) {
  throw new Error('design-system commit must be a full Git SHA')
}
if (packageManifest.dependencies[designSystem.package] !== expectedSpecifier) {
  throw new Error('package.json does not match the exact design-system lock')
}

const fixtureFiles = []
async function collectJsonFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'schemas') continue
    const entryPath = `${directory}/${entry.name}`
    if (entry.isDirectory()) {
      await collectJsonFiles(entryPath)
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      fixtureFiles.push(entryPath)
    }
  }
}
await collectJsonFiles('rules/fixtures')
if (fixtureFiles.length !== 33) {
  throw new Error(`expected 33 executable fixtures, found ${fixtureFiles.length}`)
}

const table = await readFile(
  'src/components/escopa/EscopaTableFoundation.tsx',
  'utf8',
)
if (table.includes('table-sound-fx') || table.includes('farol-felt')) {
  throw new Error('Escopa must not depend on Truco audio themes')
}

console.log(
  `validated design-system ${designSystem.commit.slice(0, 8)}, ${fixtureFiles.length} fixtures, and the standalone product boundary`,
)
