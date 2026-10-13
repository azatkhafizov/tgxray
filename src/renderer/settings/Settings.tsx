import type { AppSettings } from '@shared/types'

interface Props {
  settings: AppSettings
  onChange: (s: AppSettings) => void
}

export function Settings({ settings, onChange }: Props): JSX.Element {
  const update = async (patch: Partial<AppSettings>): Promise<void> => {
    onChange(await window.tgxray.setSettings(patch))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
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
    </div>
  )
}
