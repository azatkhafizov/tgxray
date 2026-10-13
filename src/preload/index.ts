import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings, IpcApi, LogEntry, Profile, StatusPayload } from '@shared/types'

const api: IpcApi = {
  listProfiles: () => ipcRenderer.invoke('profiles:list'),
  addProfile: (input) => ipcRenderer.invoke('profiles:add', input),
  updateProfile: (id, patch) => ipcRenderer.invoke('profiles:update', id, patch),
  deleteProfile: (id) => ipcRenderer.invoke('profiles:delete', id),
  connect: (profileId) => ipcRenderer.invoke('conn:connect', profileId),
  disconnect: () => ipcRenderer.invoke('conn:disconnect'),
  reconnect: () => ipcRenderer.invoke('conn:reconnect'),
  getStatus: () => ipcRenderer.invoke('conn:status'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  getLogs: () => ipcRenderer.invoke('logs:get'),
  clearLogs: () => ipcRenderer.invoke('logs:clear'),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  toggleSettings: (open?: boolean) => ipcRenderer.invoke('app:toggle-settings', open),
  reloadTg: () => ipcRenderer.invoke('app:reload-tg'),
  onStatus: (cb: (s: StatusPayload) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, s: StatusPayload): void => cb(s)
    ipcRenderer.on('status:update', listener)
    return () => ipcRenderer.removeListener('status:update', listener)
  },
  onLog: (cb: (e: LogEntry) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, entry: LogEntry): void => cb(entry)
    ipcRenderer.on('log:update', listener)
    return () => ipcRenderer.removeListener('log:update', listener)
  },
  onToggleSettings: (cb: (isOpen: boolean) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, isOpen: boolean): void => cb(isOpen)
    ipcRenderer.on('settings:toggle', listener)
    return () => ipcRenderer.removeListener('settings:toggle', listener)
  },
  onUnreadCount: (cb: (count: number) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, count: number): void => cb(count)
    ipcRenderer.on('unread:count', listener)
    return () => ipcRenderer.removeListener('unread:count', listener)
  }
}

contextBridge.exposeInMainWorld('tgxray', api)
