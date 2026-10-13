import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateInfoPayload } from '@shared/types'
import type { Logger } from './logger'

export class AppUpdater {
  private logger: Logger
  private currentStatus: UpdateInfoPayload = { status: 'idle' }
  private onStatusChange?: (payload: UpdateInfoPayload) => void

  constructor(logger: Logger) {
    this.logger = logger

    // Configure electron-updater
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.logger = {
      info: (msg: unknown) => this.logger.info('app', `[updater] ${String(msg)}`),
      warn: (msg: unknown) => this.logger.warning('app', `[updater] ${String(msg)}`),
      error: (msg: unknown) => this.logger.error('app', `[updater] ${String(msg)}`),
      debug: (msg: unknown) => this.logger.debug('app', `[updater] ${String(msg)}`)
    }

    autoUpdater.on('checking-for-update', () => {
      this.setStatus({ status: 'checking' })
    })

    autoUpdater.on('update-available', (info) => {
      this.logger.info('app', `[updater] New version available: v${info.version}`)
      this.setStatus({ status: 'available', version: info.version })
    })

    autoUpdater.on('update-not-available', () => {
      this.logger.info('app', '[updater] App is up to date')
      this.setStatus({ status: 'idle' })
    })

    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.round(progressObj.percent)
      this.setStatus({
        status: 'downloading',
        progress: percent
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      this.logger.info('app', `[updater] Update downloaded: v${info.version}`)
      this.setStatus({ status: 'downloaded', version: info.version })
    })

    autoUpdater.on('error', (err) => {
      const msg = (err as Error).message
      this.logger.error('app', `[updater] error: ${msg}`)
      this.setStatus({ status: 'error', error: msg })
    })
  }

  setListener(fn: (payload: UpdateInfoPayload) => void): void {
    this.onStatusChange = fn
    fn(this.currentStatus)
  }

  private setStatus(payload: UpdateInfoPayload): void {
    this.currentStatus = payload
    this.onStatusChange?.(payload)
  }

  getStatus(): UpdateInfoPayload {
    return this.currentStatus
  }

  async checkForUpdates(): Promise<UpdateInfoPayload> {
    if (!app.isPackaged) {
      this.logger.info('app', '[updater] check skipped in dev mode')
      this.setStatus({ status: 'idle' })
      return this.currentStatus
    }

    try {
      this.setStatus({ status: 'checking' })
      await autoUpdater.checkForUpdates()
    } catch (err) {
      const msg = (err as Error).message
      this.setStatus({ status: 'error', error: msg })
    }
    return this.currentStatus
  }

  install(): void {
    autoUpdater.quitAndInstall()
  }
}
