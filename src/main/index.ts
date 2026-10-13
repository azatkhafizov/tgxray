import { app, BrowserWindow, BrowserView, Menu, session, Notification } from 'electron'
import { join } from 'path'
import { ConfigStore } from './config-store'
import { Logger } from './logger'
import { XrayManager } from './xray-manager'
import { ConnectionManager } from './connection'
import { registerIpc } from './ipc-handlers'
import { TrayController } from './tray'
import { AppUpdater } from './updater'

const PARTITION = 'persist:tgxray'
const TG_URL = 'https://web.telegram.org/k/'
const TOP_BAR_HEIGHT = 44

// Single Instance Lock: prevent running multiple copies of the app
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // If user tries to launch a second instance, focus our main window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    }
  })
}

// Set App User Model ID for native notifications on Windows 10/11
if (process.platform === 'win32') {
  app.setAppUserModelId('com.tgxray.desktop')
}

let mainWindow: BrowserWindow | null = null
let tgView: BrowserView | null = null
let logger: Logger
let store: ConfigStore
let xray: XrayManager
let conn: ConnectionManager
let updater: AppUpdater
let tray: TrayController | null = null
let isSettingsOpen = false

function updateViewBounds(): void {
  if (!mainWindow || !tgView) return
  const [width, height] = mainWindow.getContentSize()
  tgView.setBounds({
    x: 0,
    y: TOP_BAR_HEIGHT,
    width,
    height: Math.max(0, height - TOP_BAR_HEIGHT)
  })
}

function loadRenderer(win: BrowserWindow): void {
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']).catch(() => undefined)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html')).catch(() => undefined)
  }
}

function setupPermissionsAndNotifications(): void {
  const ses = session.fromPartition(PARTITION)

  // Automatically grant notification and media permissions to Telegram Web
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    const url = webContents.getURL()
    if (url.includes('telegram.org')) {
      if (permission === 'notifications' || permission === 'media') {
        return callback(true)
      }
    }
    callback(false)
  })

  // Permission check handler for navigator.permissions.query
  ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    if (requestingOrigin.includes('telegram.org')) {
      if (permission === 'notifications') return true
    }
    return false
  })
}

function createMainWindow(): BrowserWindow {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icons', 'icon.png')
    : join(app.getAppPath(), 'resources', 'icons', 'icon.png')

  // Remove top application menu (File, Edit, View, Window, Help)
  Menu.setApplicationMenu(null)

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Telegram Desktop (Xray)',
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.setMenuBarVisibility(false)
  loadRenderer(win)

  tgView = new BrowserView({
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // tgView will be added when proxy connection is established or user is connected
  tgView.webContents.loadURL(TG_URL).catch(() => undefined)

  // Forward clicks on notifications or telegram links to focus window
  tgView.webContents.setWindowOpenHandler(({ url }) => {
    // Open external links in default browser
    if (!url.includes('telegram.org')) {
      import('electron').then(({ shell }) => shell.openExternal(url)).catch(() => undefined)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  // Setup unread message counter via DOM polling inside Telegram Web
  const UNREAD_SCRIPT = `
    (() => {
      function getTelegramUnreadCount() {
        let count = 0;
        // 1. Web K
        const badgesK = document.querySelectorAll('.chatlist-chat .dialog-subtitle-badge.unread');
        if (badgesK.length > 0) {
          badgesK.forEach(badge => {
            const chatItem = badge.closest('.chatlist-chat');
            const isMuted = chatItem?.classList.contains('is-muted') || 
                            chatItem?.classList.contains('muted') ||
                            badge.classList.contains('is-muted') ||
                            badge.classList.contains('muted') ||
                            chatItem?.querySelector('.dialog-title-details .icon-muted, .icon-muted-fill') !== null;
            if (!isMuted) {
              const val = parseInt(badge.textContent.trim(), 10);
              if (!isNaN(val)) count += val;
            }
          });
          return count;
        }

        // 2. Web A (standard + obfuscated CSS modules)
        const badgesA = document.querySelectorAll(
          '.chat-badge-transition span, [class*="chat-badge"] span, .ListItem.Chat .Badge, .chat-item-clickable .Badge'
        );
        if (badgesA.length > 0) {
          badgesA.forEach(badge => {
            const text = badge.textContent.trim();
            if (!/^\\d+$/.test(text)) return;

            const badgeContainer = badge.closest('.NT-X2xr9, [class*="chat-badge"], .Badge, .BadgeWrapper');
            const chatItem = badge.closest('.chat-item-clickable, [data-peer-id], .ListItem');

            const isMuted = badgeContainer?.classList.contains('yf73Yld8') ||
                            badgeContainer?.classList.contains('muted') ||
                            badge.classList.contains('RbmAYSe4') ||
                            badge.classList.contains('muted') ||
                            (chatItem && (
                              chatItem.classList.contains('muted') ||
                              chatItem.classList.contains('is-muted') ||
                              chatItem.querySelector('i.icon-muted, .icon-muted, [class*="muted"]') !== null
                            ));
            if (!isMuted) {
              const val = parseInt(text, 10);
              if (!isNaN(val)) count += val;
            }
          });
          return count;
        }
        return 0;
      }
      return getTelegramUnreadCount();
    })()
  `

  let lastUnread = 0
  const checkUnread = async () => {
    if (!tgView || tgView.webContents.isDestroyed()) return
    try {
      const count = (await tgView.webContents.executeJavaScript(UNREAD_SCRIPT)) as number
      if (typeof count === 'number' && count !== lastUnread) {
        lastUnread = count
        tray?.setUnreadCount(count)
        mainWindow?.webContents.send('unread:count', count)

        // Native badge count on macOS / Linux
        app.setBadgeCount(count)

        if (count > 0 && !win.isFocused()) {
          if (process.platform === 'win32' || process.platform === 'linux') {
            win.flashFrame(true)
          } else if (process.platform === 'darwin') {
            app.dock.bounce('informational')
          }
        }
      }
    } catch {
      // Ignore if page is navigating or reloading
    }
  }

  const unreadInterval = setInterval(checkUnread, 2000)

  // Flash frame / bounce dock on unread messages if window is not focused
  tgView.webContents.on('page-title-updated', (_e, title) => {
    const hasUnread = /^\(\d+\)/.test(title)
    if (hasUnread && !win.isFocused()) {
      if (process.platform === 'win32' || process.platform === 'linux') {
        win.flashFrame(true)
      } else if (process.platform === 'darwin') {
        app.dock.bounce('informational')
      }
    }
    void checkUnread()
  })

  win.on('focus', () => {
    win.flashFrame(false)
  })

  win.on('resize', updateViewBounds)

  win.on('close', (e) => {
    if (store.getSettings().minimizeToTray && tray && !quitting) {
      e.preventDefault()
      win.hide()
    } else {
      clearInterval(unreadInterval)
    }
  })

  return win
}

function toggleSettings(open?: boolean): void {
  if (!mainWindow || !tgView) return
  isSettingsOpen = open !== undefined ? open : !isSettingsOpen
  if (isSettingsOpen) {
    mainWindow.removeBrowserView(tgView)
  } else {
    // Only mount tgView if connection is connected (or user explicitly closes settings)
    if (conn.getStatus().state === 'connected') {
      mainWindow.addBrowserView(tgView)
      updateViewBounds()
    }
  }
  mainWindow.webContents.send('settings:toggle', isSettingsOpen)
}

async function bootstrap(): Promise<void> {
  setupPermissionsAndNotifications()
  logger = new Logger()
  store = new ConfigStore()
  await store.load()
  xray = new XrayManager(logger)
  conn = new ConnectionManager(logger, store, xray)

  registerIpc(store, conn, logger)

  updater = new AppUpdater(logger)
  updater.setListener((info) => {
    mainWindow?.webContents.send('update:status', info)
  })

  // IPC for toggling settings overlay and updater
  const { ipcMain } = await import('electron')
  ipcMain.handle('app:toggle-settings', (_e, open?: boolean) => {
    toggleSettings(open)
    return isSettingsOpen
  })
  ipcMain.handle('app:reload-tg', () => {
    tgView?.webContents.reload()
  })
  ipcMain.handle('app:check-updates', () => {
    return updater.checkForUpdates()
  })
  ipcMain.handle('app:install-update', () => {
    updater.install()
  })

  xray.on('crashed', (err: Error) => logger.error('app', `xray crashed: ${err.message}`))
  conn.on('status', (s) => {
    mainWindow?.webContents.send('status:update', s)
    if (s.state === 'connected') {
      if (!isSettingsOpen && mainWindow && tgView) {
        mainWindow.addBrowserView(tgView)
        updateViewBounds()
      }
      tgView?.webContents.loadURL(TG_URL).catch(() => undefined)
    } else {
      if (!isSettingsOpen && mainWindow && tgView) {
        mainWindow.removeBrowserView(tgView)
      }
    }
  })
  logger.on('log', (entry) => {
    mainWindow?.webContents.send('log:update', entry)
  })

  mainWindow = createMainWindow()
  tray = new TrayController(mainWindow, conn, logger)
  tray.init()

  // Background check for updates in packaged release
  if (app.isPackaged) {
    setTimeout(() => {
      void updater.checkForUpdates()
    }, 5000)
  }

  const lastProfile = store.getLastProfileId()
  if (lastProfile) {
    void conn.connect(lastProfile)
  } else if (store.listProfiles().length > 0) {
    void conn.connect(store.listProfiles()[0].id)
  } else {
    // If no profiles exist yet, open settings overlay automatically
    toggleSettings(true)
  }
}

if (gotTheLock) {
  app.whenReady().then(bootstrap).catch((err) => {
    console.error('bootstrap failed', err)
    app.quit()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow()
  }
})

let quitting = false
app.on('before-quit', (e) => {
  if (quitting) return
  quitting = true
  e.preventDefault()
  void conn.shutdown().finally(() => {
    tray?.destroy()
    app.exit(0)
  })
})

process.on('SIGTERM', () => void conn?.shutdown().finally(() => app.exit(0)))
process.on('SIGINT', () => void conn?.shutdown().finally(() => app.exit(0)))
