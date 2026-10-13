export type ConnState = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface Profile {
  id: string
  name: string
  source: 'link' | 'file'
  link: string
  createdAt: number
  updatedAt: number
}

export type LogScope = 'app' | 'xray' | 'proxy'
export type LogLevelName = 'error' | 'warning' | 'info' | 'debug'

export interface LogEntry {
  ts: number
  level: LogLevelName
  scope: LogScope
  message: string
}

export interface AppSettings {
  autoConnect: boolean
  autoLaunch: boolean
  minimizeToTray: boolean
  logLevel: 'error' | 'warning' | 'info' | 'debug'
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoConnect: false,
  autoLaunch: false,
  minimizeToTray: true,
  logLevel: 'info'
}

export interface StatusPayload {
  state: ConnState
  message?: string
  profileId?: string
  externalIp?: string
  xrayPid?: number
  socksPort?: number
  httpPort?: number
}

export interface IpcApi {
  listProfiles: () => Promise<Profile[]>
  addProfile: (input: { name: string; source: 'link' | 'file'; link: string }) => Promise<Profile>
  updateProfile: (id: string, patch: { name?: string; link?: string }) => Promise<Profile | null>
  deleteProfile: (id: string) => Promise<boolean>
  connect: (profileId: string) => Promise<StatusPayload>
  disconnect: () => Promise<StatusPayload>
  reconnect: () => Promise<StatusPayload>
  getStatus: () => Promise<StatusPayload>
  getSettings: () => Promise<AppSettings>
  setSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
  getLogs: () => Promise<LogEntry[]>
  clearLogs: () => Promise<void>
  readClipboard: () => Promise<string>
  toggleSettings: (open?: boolean) => Promise<boolean>
  reloadTg: () => Promise<void>
  onStatus: (cb: (s: StatusPayload) => void) => () => void
  onLog: (cb: (e: LogEntry) => void) => () => void
  onToggleSettings: (cb: (isOpen: boolean) => void) => () => void
  onUnreadCount: (cb: (count: number) => void) => () => void
}
