import { createWriteStream } from 'node:fs'
import { mkdir, chmod, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const execFileAsync = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))

const pkg = require('../package.json') as { xrayVersion?: string }
const VERSION = pkg.xrayVersion ?? '1.8.24'
const ROOT = join(__dirname, '..', 'resources', 'bin')

interface Target {
  key: string
  platform: 'win32' | 'darwin' | 'linux'
  arch: string
  asset: string
  exe: string
}

const TARGETS: Target[] = [
  { key: 'win32-x64', platform: 'win32', arch: 'x64', asset: 'Xray-windows-64.zip', exe: 'xray.exe' },
  { key: 'darwin-x64', platform: 'darwin', arch: 'x64', asset: 'Xray-macos-64.zip', exe: 'xray' },
  { key: 'darwin-arm64', platform: 'darwin', arch: 'arm64', asset: 'Xray-macos-arm64-v8a.zip', exe: 'xray' },
  { key: 'linux-x64', platform: 'linux', arch: 'x64', asset: 'Xray-linux-64.zip', exe: 'xray' }
]

function assetUrl(asset: string): string {
  return `https://github.com/XTLS/Xray-core/releases/download/v${VERSION}/${asset}`
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok || !res.body) throw new Error(`download failed ${url}: ${res.status}`)
  await mkdir(dirname(dest), { recursive: true })
  await pipeline(res.body as unknown as NodeJS.ReadableStream, createWriteStream(dest))
}

async function unzip(zipPath: string, outDir: string): Promise<void> {
  await mkdir(outDir, { recursive: true })
  if (process.platform === 'win32') {
    await execFileAsync('powershell', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${outDir}' -Force`
    ])
  } else {
    await execFileAsync('unzip', ['-o', zipPath, '-d', outDir])
  }
}

async function fetchTarget(t: Target): Promise<void> {
  const outDir = join(ROOT, t.platform)
  const tmp = join(ROOT, `${t.key}.zip`)
  const finalPath = join(outDir, t.exe)
  console.log(`[fetch-xray] ${t.platform}/${t.arch} <- ${assetUrl(t.asset)}`)
  await download(assetUrl(t.asset), tmp)
  await unzip(tmp, outDir)
  await rm(tmp, { force: true })
  if (t.exe !== 'xray.exe') await chmod(finalPath, 0o755)
  console.log(`[fetch-xray] saved ${finalPath}`)
}

async function main(): Promise<void> {
  const only = process.argv.slice(2)
  const targets = only.length ? TARGETS.filter((t) => only.includes(t.key)) : TARGETS
  if (only.length && targets.length === 0) {
    console.error(`[fetch-xray] no matching targets for: ${only.join(', ')}`)
    process.exitCode = 1
    return
  }
  for (const t of targets) {
    try {
      await fetchTarget(t)
    } catch (err) {
      console.error(`[fetch-xray] failed ${t.key}: ${(err as Error).message}`)
      process.exitCode = 1
    }
  }
}

void main()
