import { EventEmitter } from 'events'
import { promises as fs } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { LogEntry } from '@shared/types'
import { maskSecret } from '@shared/mask'

const MAX_BUFFER = 2000

export class Logger extends EventEmitter {
  private buffer: LogEntry[] = []
  private logFile: string
  private streamReady: Promise<void>

  constructor() {
    super()
    this.logFile = join(app.getPath('userData'), 'xray.log')
    this.streamReady = fs.mkdir(app.getPath('userData'), { recursive: true }).then(() => undefined)
  }

  private emitEntry(entry: LogEntry): void {
    this.buffer.push(entry)
    if (this.buffer.length > MAX_BUFFER) this.buffer.splice(0, this.buffer.length - MAX_BUFFER)
    this.emit('log', entry)
  }

  private async appendFile(entry: LogEntry): Promise<void> {
    await this.streamReady
    const line = `${new Date(entry.ts).toISOString()} [${entry.scope}/${entry.level}] ${entry.message}\n`
    await fs.appendFile(this.logFile, line).catch(() => undefined)
  }

  private write(level: LogEntry['level'], scope: LogEntry['scope'], message: string): void {
    const safe = maskSecret(message)
    const entry: LogEntry = { ts: Date.now(), level, scope, message: safe }
    this.emitEntry(entry)
    void this.appendFile(entry)
  }

  error(scope: LogEntry['scope'], message: string): void {
    this.write('error', scope, message)
  }

  warning(scope: LogEntry['scope'], message: string): void {
    this.write('warning', scope, message)
  }

  info(scope: LogEntry['scope'], message: string): void {
    this.write('info', scope, message)
  }

  debug(scope: LogEntry['scope'], message: string): void {
    this.write('debug', scope, message)
  }

  getEntries(): LogEntry[] {
    return this.buffer.map((e) => ({ ...e }))
  }

  clear(): void {
    this.buffer = []
    void fs.writeFile(this.logFile, '').catch(() => undefined)
  }
}
