import { app, safeStorage } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { AppSettings, Profile } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'

interface StoreShape {
  profiles: Profile[]
  settings: AppSettings
  lastProfileId: string | null
}

const EMPTY: StoreShape = { profiles: [], settings: { ...DEFAULT_SETTINGS }, lastProfileId: null }

export class ConfigStore {
  private file: string
  private data: StoreShape = { ...EMPTY }
  private loaded = false

  constructor() {
    this.file = join(app.getPath('userData'), 'tgxray-store.enc')
  }

  private encrypt(plain: string): Buffer {
    if (safeStorage.isEncryptionAvailable()) return safeStorage.encryptString(plain)
    return Buffer.from(plain, 'utf-8')
  }

  private decrypt(buf: Buffer): string {
    if (safeStorage.isEncryptionAvailable()) {
      try {
        return safeStorage.decryptString(buf)
      } catch {
        return buf.toString('utf-8')
      }
    }
    return buf.toString('utf-8')
  }

  async load(): Promise<void> {
    if (this.loaded) return
    try {
      const buf = await fs.readFile(this.file)
      const parsed = JSON.parse(this.decrypt(buf)) as Partial<StoreShape>
      this.data = {
        profiles: parsed.profiles ?? [],
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
        lastProfileId: parsed.lastProfileId ?? null
      }
    } catch {
      this.data = { ...EMPTY, settings: { ...DEFAULT_SETTINGS } }
    }
    this.loaded = true
  }

  private async persist(): Promise<void> {
    const buf = this.encrypt(JSON.stringify(this.data))
    await fs.mkdir(app.getPath('userData'), { recursive: true })
    await fs.writeFile(this.file, buf)
  }

  listProfiles(): Profile[] {
    return this.data.profiles.map((p) => ({ ...p }))
  }

  getProfile(id: string): Profile | null {
    const p = this.data.profiles.find((x) => x.id === id)
    return p ? { ...p } : null
  }

  async addProfile(input: { name: string; source: 'link' | 'file'; link: string }): Promise<Profile> {
    const now = Date.now()
    const profile: Profile = {
      id: randomUUID(),
      name: input.name,
      source: input.source,
      link: input.link,
      createdAt: now,
      updatedAt: now
    }
    this.data.profiles.push(profile)
    await this.persist()
    return { ...profile }
  }

  async updateProfile(id: string, patch: { name?: string; link?: string }): Promise<Profile | null> {
    const p = this.data.profiles.find((x) => x.id === id)
    if (!p) return null
    if (patch.name !== undefined) p.name = patch.name
    if (patch.link !== undefined) p.link = patch.link
    p.updatedAt = Date.now()
    await this.persist()
    return { ...p }
  }

  async deleteProfile(id: string): Promise<boolean> {
    const before = this.data.profiles.length
    this.data.profiles = this.data.profiles.filter((x) => x.id !== id)
    if (this.data.lastProfileId === id) this.data.lastProfileId = null
    const changed = this.data.profiles.length !== before
    if (changed) await this.persist()
    return changed
  }

  getSettings(): AppSettings {
    return { ...this.data.settings }
  }

  async setSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    this.data.settings = { ...this.data.settings, ...patch }
    await this.persist()
    return { ...this.data.settings }
  }

  getLastProfileId(): string | null {
    return this.data.lastProfileId
  }

  async setLastProfileId(id: string | null): Promise<void> {
    this.data.lastProfileId = id
    await this.persist()
  }
}
