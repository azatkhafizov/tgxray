import { app, Menu, Tray, nativeImage, type BrowserWindow } from 'electron'
import { join } from 'path'
import type { Logger } from './logger'
import type { ConnectionManager } from './connection'

export class TrayController {
  private tray: Tray | null = null
  private win: BrowserWindow
  private conn: ConnectionManager
  private logger: Logger

  constructor(win: BrowserWindow, conn: ConnectionManager, logger: Logger) {
    this.win = win
    this.conn = conn
    this.logger = logger
  }

  private getIconPath(statusState: string): string {
    const iconName =
      statusState === 'connected'
        ? 'tray-connected.png'
        : statusState === 'connecting'
          ? 'tray-connecting.png'
          : statusState === 'error'
            ? 'tray-error.png'
            : 'tray-disconnected.png'

    if (app.isPackaged) {
      return join(process.resourcesPath, 'icons', iconName)
    }
    return join(app.getAppPath(), 'resources', 'icons', iconName)
  }

  init(): void {
    const iconPath = this.getIconPath('disconnected')
    const icon = nativeImage.createFromPath(iconPath)
    this.tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
    this.tray.setToolTip('Telegram Xray')
    this.tray.on('click', () => this.showWindow())
    this.conn.on('status', () => this.refresh())
    this.refresh()
  }

  refresh(): void {
    if (!this.tray) return
    const status = this.conn.getStatus()
    const iconPath = this.getIconPath(status.state)
    const icon = nativeImage.createFromPath(iconPath)
    if (!icon.isEmpty()) {
      this.tray.setImage(icon)
    }

    const label =
      status.state === 'connected'
        ? `Connected${status.externalIp ? ` (${status.externalIp})` : ''}`
        : status.state === 'connecting'
          ? 'Connecting…'
          : status.state === 'error'
            ? `Error: ${status.message ?? 'unknown'}`
            : 'Disconnected'
    const menu = Menu.buildFromTemplate([
      { label, enabled: false },
      { type: 'separator' },
      { label: 'Show window', click: () => this.showWindow() },
      { label: 'Connect', click: () => void this.conn.reconnect() },
      { label: 'Disconnect', click: () => void this.conn.disconnect() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
    this.tray.setContextMenu(menu)
    this.tray.setToolTip(`Telegram Xray — ${label}`)
  }

  private showWindow(): void {
    if (this.win.isMinimized()) this.win.restore()
    this.win.show()
    this.win.focus()
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}
