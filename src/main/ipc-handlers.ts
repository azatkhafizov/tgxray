import { ipcMain, clipboard } from 'electron'
import type { AppSettings } from '@shared/types'
import type { ConfigStore } from './config-store'
import type { ConnectionManager } from './connection'
import type { Logger } from './logger'

export function registerIpc(store: ConfigStore, conn: ConnectionManager, logger: Logger): void {
  ipcMain.handle('profiles:list', () => store.listProfiles())
  ipcMain.handle('profiles:add', (_e, input: { name: string; source: 'link' | 'file'; link: string }) =>
    store.addProfile(input)
  )
  ipcMain.handle('profiles:update', (_e, id: string, patch: { name?: string; link?: string }) =>
    store.updateProfile(id, patch)
  )
  ipcMain.handle('profiles:delete', (_e, id: string) => store.deleteProfile(id))

  ipcMain.handle('conn:connect', (_e, profileId: string) => conn.connect(profileId))
  ipcMain.handle('conn:disconnect', () => conn.disconnect())
  ipcMain.handle('conn:reconnect', () => conn.reconnect())
  ipcMain.handle('conn:status', () => conn.getStatus())

  ipcMain.handle('settings:get', () => store.getSettings())
  ipcMain.handle('settings:set', (_e, patch: Partial<AppSettings>) => store.setSettings(patch))

  ipcMain.handle('logs:get', () => logger.getEntries())
  ipcMain.handle('logs:clear', () => logger.clear())

  ipcMain.handle('clipboard:read', () => clipboard.readText())
}
