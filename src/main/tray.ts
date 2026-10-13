import { app, Menu, Tray, nativeImage, type BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import type { Logger } from './logger'
import type { ConnectionManager } from './connection'

export class TrayController {
  private tray: Tray | null = null
  private win: BrowserWindow
  private conn: ConnectionManager
  private logger: Logger
  private unreadCount = 0

  constructor(win: BrowserWindow, conn: ConnectionManager, logger: Logger) {
    this.win = win
    this.conn = conn
    this.logger = logger
  }

  setUnreadCount(count: number): void {
    if (this.unreadCount === count) return
    this.unreadCount = count
    this.refresh()
  }

  private getIconPath(statusState: string): string {
    const iconsDir = app.isPackaged
      ? join(process.resourcesPath, 'icons')
      : join(app.getAppPath(), 'resources', 'icons')

    if (this.unreadCount > 0) {
      const countLabel = this.unreadCount > 99 ? '99plus' : String(this.unreadCount)
      const badgeIcon = join(iconsDir, 'badges', `${statusState}-${countLabel}.png`)
      if (existsSync(badgeIcon)) {
        return badgeIcon
      }
    }

    const iconName =
      statusState === 'connected'
        ? 'tray-connected.png'
        : statusState === 'connecting'
          ? 'tray-connecting.png'
          : statusState === 'error'
            ? 'tray-error.png'
            : 'tray-disconnected.png'

    return join(iconsDir, iconName)
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

    // Native badge title on macOS
    if (process.platform === 'darwin') {
      this.tray.setTitle(this.unreadCount > 0 ? ` ${this.unreadCount}` : '')
    }

    const stateText =
      status.state === 'connected'
        ? `Connected${status.externalIp ? ` (${status.externalIp})` : ''}`
        : status.state === 'connecting'
          ? 'Connecting…'
          : status.state === 'error'
            ? `Error: ${status.message ?? 'unknown'}`
            : 'Disconnected'

    const unreadLabel = this.unreadCount > 0 ? ` (${this.unreadCount} unread)` : ''
    const tooltipText = `Telegram Xray — ${stateText}${unreadLabel}`

    const menuItems: Electron.MenuItemConstructorOptions[] = [
      { label: `Status: ${stateText}`, enabled: false }
    ]

    if (this.unreadCount > 0) {
      menuItems.push({ label: `💬 Unread: ${this.unreadCount}`, enabled: false })
    }

    menuItems.push(
      { type: 'separator' },
      { label: 'Show window', click: () => this.showWindow() },
      { label: 'Connect', click: () => void this.conn.reconnect() },
      { label: 'Disconnect', click: () => void this.conn.disconnect() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    )

    this.tray.setContextMenu(Menu.buildFromTemplate(menuItems))
    this.tray.setToolTip(tooltipText)
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
