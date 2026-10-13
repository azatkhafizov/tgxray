import { EventEmitter } from 'events'
import { session } from 'electron'
import { readFile } from 'fs/promises'
import type { ConnState, StatusPayload } from '@shared/types'
import { parseShareLink, type ParsedOutbound, type LogLevel } from '@shared/parse-link'
import { buildXrayClientConfig } from '@shared/build-config'
import type { Logger } from './logger'
import type { ConfigStore } from './config-store'
import { XrayManager, findFreePort } from './xray-manager'

const PARTITION = 'persist:tgxray'

export class ConnectionManager extends EventEmitter {
  private xray: XrayManager
  private logger: Logger
  private store: ConfigStore
  private state: ConnState = 'disconnected'
  private message: string | undefined
  private profileId: string | undefined
  private externalIp: string | undefined

  constructor(logger: Logger, store: ConfigStore, xray: XrayManager) {
    super()
    this.logger = logger
    this.store = store
    this.xray = xray
  }

  getStatus(): StatusPayload {
    return {
      state: this.state,
      message: this.message,
      profileId: this.profileId,
      externalIp: this.externalIp,
      xrayPid: this.xray.pid,
      socksPort: this.xray.socksPort || undefined,
      httpPort: this.xray.httpPort || undefined
    }
  }

  private setState(state: ConnState, message?: string, profileId?: string): void {
    this.state = state
    this.message = message
    this.profileId = profileId ?? this.profileId
    if (state === 'disconnected' || state === 'connecting') this.externalIp = undefined
    this.emit('status', this.getStatus())
  }

  private async buildOutbound(profile: { source: 'link' | 'file'; link: string }): Promise<ParsedOutbound> {
    if (profile.source === 'link') return parseShareLink(profile.link)
    const raw = await readFile(profile.link, 'utf-8')
    const json = JSON.parse(raw) as Record<string, unknown>
    const first = Array.isArray(json.outbounds) ? (json.outbounds[0] as Record<string, unknown>) : undefined
    if (!first) throw new Error('config.json: no outbounds found')
    return {
      protocol: first.protocol as ParsedOutbound['protocol'],
      tag: String(first.tag || 'proxy'),
      address: '',
      port: 0,
      rawLink: profile.link,
      settings: (first.settings as Record<string, unknown>) ?? {},
      streamSettings: (first.streamSettings as Record<string, unknown>) ?? {}
    }
  }

  async connect(profileId: string): Promise<StatusPayload> {
    const profile = this.store.getProfile(profileId)
    if (!profile) {
      this.setState('error', 'profile not found')
      return this.getStatus()
    }
    this.setState('connecting', undefined, profileId)
    try {
      const outbound = await this.buildOutbound(profile)
      const logLevel = this.store.getSettings().logLevel as LogLevel
      const res = await this.xray.start(outbound, logLevel)

      const ses = session.fromPartition(PARTITION)
      // Chromium supports native HTTP proxy natively without extra node socket bridge,
      // and Xray has a built-in http-in on res.httpPort!
      // Also fallback to SOCKS5 rule syntax: 'http=127.0.0.1:port;https=127.0.0.1:port' or 'http://127.0.0.1:port'
      await ses.setProxy({
        proxyRules: `http://127.0.0.1:${res.httpPort}`,
        proxyBypassRules: '<-loopback>'
      })
      await this.store.setLastProfileId(profileId)
      this.setState('connected', undefined, profileId)
      void this.checkExternalIp(ses)
      return this.getStatus()
    } catch (err) {
      const msg = (err as Error).message
      this.logger.error('app', `connect failed: ${msg}`)
      await this.teardown()
      this.setState('error', msg, profileId)
      return this.getStatus()
    }
  }

  private async checkExternalIp(ses: Electron.Session): Promise<void> {
    try {
      const res = await ses.fetch('https://api.ipify.org?format=json')
      if (!res.ok) return
      const data = (await res.json()) as { ip?: string }
      if (data.ip && this.state === 'connected') {
        this.externalIp = data.ip
        this.emit('status', this.getStatus())
      }
    } catch (err) {
      this.logger.debug('app', `external ip check failed: ${(err as Error).message}`)
    }
  }

  async disconnect(): Promise<StatusPayload> {
    this.setState('disconnected')
    await this.teardown()
    return this.getStatus()
  }

  async reconnect(): Promise<StatusPayload> {
    const id = this.profileId ?? this.store.getLastProfileId()
    if (!id) {
      this.setState('error', 'no profile to reconnect')
      return this.getStatus()
    }
    return this.connect(id)
  }

  private async teardown(): Promise<void> {
    try {
      await session.fromPartition(PARTITION).setProxy({ mode: 'direct' })
    } catch {
      void 0
    }
    await this.xray.stop().catch(() => undefined)
  }

  async shutdown(): Promise<void> {
    await this.teardown()
  }
}

export { findFreePort }
