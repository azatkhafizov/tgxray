import type { AppSettings, UpdateInfoPayload } from '@shared/types'

interface Props {
  settings: AppSettings
  updateInfo: UpdateInfoPayload
  onChange: (s: AppSettings) => void
}

export function Settings({ settings, updateInfo, onChange }: Props): JSX.Element {
  const update = async (patch: Partial<AppSettings>): Promise<void> => {
    onChange(await window.tgxray.setSettings(patch))
  }

  const checkUpdates = async (): Promise<void> => {
    await window.tgxray.checkForUpdates()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={settings.autoConnect} onChange={(e) => void update({ autoConnect: e.target.checked })} />
          Auto-connect last profile on start
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={settings.minimizeToTray} onChange={(e) => void update({ minimizeToTray: e.target.checked })} />
          Minimize to tray on close
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={settings.autoLaunch} onChange={(e) => void update({ autoLaunch: e.target.checked })} />
          Launch at system startup
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Xray log level</span>
          <select value={settings.logLevel} onChange={(e) => void update({ logLevel: e.target.value as AppSettings['logLevel'] })}>
            <option value="error">error</option>
            <option value="warning">warning</option>
            <option value="info">info</option>
            <option value="debug">debug</option>
          </select>
        </label>
      </section>

      <section style={{ borderTop: '1px solid #242f3d', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <strong>Software Updates (GitHub)</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => void checkUpdates()}
            disabled={updateInfo.status === 'checking' || updateInfo.status === 'downloading'}
            style={{ background: '#2b5278', color: '#fff' }}
          >
            {updateInfo.status === 'checking' ? 'Checking…' : 'Check for Updates'}
          </button>
          {updateInfo.status === 'downloaded' && (
            <button
              onClick={() => void window.tgxray.installUpdate()}
              style={{ background: '#9b59b6', color: '#fff', fontWeight: 600 }}
            >
              Restart & Install v{updateInfo.version}
            </button>
          )}
        </div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          {updateInfo.status === 'checking' && <span>Checking https://github.com/azatkhafizov/tgxray/releases…</span>}
          {updateInfo.status === 'downloading' && <span>Downloading update: {updateInfo.progress ?? 0}%</span>}
          {updateInfo.status === 'available' && <span>New version v{updateInfo.version} found, downloading in background…</span>}
          {updateInfo.status === 'downloaded' && <span style={{ color: '#2ecc71' }}>Version v{updateInfo.version} downloaded and ready to install!</span>}
          {updateInfo.status === 'error' && <span style={{ color: '#e74c3c' }}>Update check error: {updateInfo.error}</span>}
          {updateInfo.status === 'idle' && <span>Releases are fetched from github.com/azatkhafizov/tgxray</span>}
        </div>
      </section>
    </div>
  )
}
