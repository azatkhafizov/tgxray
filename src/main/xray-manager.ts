import { EventEmitter } from 'events'
import { spawn, type ChildProcess } from 'child_process'
import { createServer } from 'net'
import { promises as fs } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { LogLevel, ParsedOutbound } from '@shared/parse-link'
import { buildXrayClientConfig } from '@shared/build-config'
import type { Logger } from './logger'

const MAX_RESTARTS = 5
const BACKOFF_BASE = 1000

function getPlatformDir(): string {
  if (process.platform === 'win32') return 'win32'
  if (process.platform === 'darwin') return 'darwin'
  return 'linux'
}

export function resolveXrayBinary(): string {
  const dir = getPlatformDir()
  const exe = process.platform === 'win32' ? 'xray.exe' : 'xray'
  if (app.isPackaged) return join(process.resourcesPath, 'bin', dir, exe)
  return join(app.getAppPath(), 'resources', 'bin', dir, exe)
}

export function findFreePort(preferred: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number): void => {
      const server = createServer()
      server.once('error', () => {
        server.close()
        if (port === preferred) tryPort(0)
        else reject(new Error(`no free port available (tried ${preferred} and random)`))
      })
      server.listen(port, '127.0.0.1', () => {
        const addr = server.address()
        const chosen = typeof addr === 'object' && addr ? addr.port : port
        server.close(() => resolve(chosen))
      })
    }
    tryPort(preferred)
  })
}

function waitForPort(port: number, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    const attempt = (): void => {
      const socket = createServer()
      socket.once('error', () => {
        socket.close()
        if (Date.now() > deadline) reject(new Error(`xray did not open port ${port} in time`))
        else setTimeout(attempt, 200)
      })
      socket.listen(port, '127.0.0.1', () => socket.close(() => resolve()))
    }
    attempt()
  })
}

export interface XrayStartResult {
  pid: number | undefined
  socksPort: number
  httpPort: number
}

export class XrayManager extends EventEmitter {
  private proc: ChildProcess | null = null
  private logger: Logger
  private restarts = 0
  private manualStop = false
  private configPath: string
  private currentSocksPort = 0
  private currentHttpPort = 0

  constructor(logger: Logger) {
    super()
    this.logger = logger
    this.configPath = join(app.getPath('userData'), 'xray-active.json')
  }

  get socksPort(): number {
    return this.currentSocksPort
  }

  get httpPort(): number {
    return this.currentHttpPort
  }

  get pid(): number | undefined {
    return this.proc?.pid
  }

  private attachStreams(): void {
    if (!this.proc) return
    const onData = (level: 'info' | 'error') => (buf: Buffer) => {
      const text = buf.toString('utf-8').trim()
      if (text) this.logger[level]('xray', text)
    }
    this.proc.stdout?.on('data', onData('info'))
    this.proc.stderr?.on('data', onData('error'))
  }

  async start(outbound: ParsedOutbound, logLevel: LogLevel): Promise<XrayStartResult> {
    await this.stop()
    this.manualStop = false
    const socksPort = await findFreePort(2080)
    const httpPort = await findFreePort(2081)
    const config = buildXrayClientConfig({ outbound, socksPort, httpPort, logLevel })
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8')
    return this.spawnProcess(socksPort, httpPort)
  }

  private async spawnProcess(socksPort: number, httpPort: number): Promise<XrayStartResult> {
    const bin = resolveXrayBinary()
    this.logger.info('app', `starting xray: ${bin}`)
    const proc = spawn(bin, ['run', '-c', this.configPath], { windowsHide: true })
    this.proc = proc
    this.currentSocksPort = socksPort
    this.currentHttpPort = httpPort
    this.attachStreams()

    proc.on('exit', (code, signal) => {
      this.logger.warning('xray', `xray exited code=${code ?? 'null'} signal=${signal ?? 'null'}`)
      this.proc = null
      if (this.manualStop) return
      if (this.restarts >= MAX_RESTARTS) {
        this.emit('crashed', new Error('xray crashed too many times'))
        return
      }
      this.restarts += 1
      const delay = BACKOFF_BASE * this.restarts
      this.logger.warning('app', `restarting xray in ${delay}ms (attempt ${this.restarts})`)
      setTimeout(() => {
        if (this.manualStop) return
        void this.spawnProcess(socksPort, httpPort).catch((err) => this.emit('crashed', err))
      }, delay)
    })

    proc.on('error', (err) => {
      this.logger.error('xray', `failed to spawn xray: ${err.message}`)
    })

    try {
      await waitForPort(socksPort)
    } catch (err) {
      this.logger.error('app', `xray healthcheck failed: ${(err as Error).message}`)
      await this.stop()
      throw err
    }
    this.restarts = 0
    this.emit('started', { pid: proc.pid, socksPort, httpPort })
    return { pid: proc.pid, socksPort, httpPort }
  }

  async stop(): Promise<void> {
    this.manualStop = true
    const proc = this.proc
    if (!proc) return
    this.proc = null
    return new Promise((resolve) => {
      const done = (): void => {
        this.logger.info('app', 'xray stopped')
        resolve()
      }
      proc.once('exit', done)
      if (process.platform === 'win32') proc.kill()
      else proc.kill('SIGTERM')
      setTimeout(() => {
        if (proc.exitCode === null && proc.signalCode === null) {
          try {
            proc.kill('SIGKILL')
          } catch {
            void 0
          }
        }
      }, 4000)
    })
  }

  async restart(outbound: ParsedOutbound, logLevel: LogLevel): Promise<XrayStartResult> {
    return this.start(outbound, logLevel)
  }

  isRunning(): boolean {
    return this.proc !== null
  }
}
