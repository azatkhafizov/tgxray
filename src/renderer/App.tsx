import { useEffect, useState } from 'react'
import type { AppSettings, LogEntry, Profile, StatusPayload, UpdateInfoPayload } from '@shared/types'
import { Profiles } from './profiles/Profiles'
import { Settings } from './settings/Settings'
import { Logs } from './logs/Logs'

type Tab = 'profiles' | 'settings' | 'logs'

function stateDot(state: StatusPayload['state']): string {
  if (state === 'connected') return '#2ecc71'
  if (state === 'connecting') return '#f1c40f'
  if (state === 'error') return '#e74c3c'
  return '#7f8c8d'
}

export function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('profiles')
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)
  const [status, setStatus] = useState<StatusPayload>({ state: 'disconnected' })
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [appVersion, setAppVersion] = useState<string>('')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfoPayload>({ status: 'idle' })
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])

  const refreshProfiles = async (): Promise<void> => setProfiles(await window.tgxray.listProfiles())

  useEffect(() => {
    void window.tgxray.getStatus().then(setStatus)
    void refreshProfiles()
    void window.tgxray.getSettings().then(setSettings)
    void window.tgxray.getLogs().then(setLogs)
    void window.tgxray.getAppVersion().then(setAppVersion)

    const offStatus = window.tgxray.onStatus(setStatus)
    const offLog = window.tgxray.onLog((entry) =>
      setLogs((prev) => [...prev.slice(-1999), entry])
    )
    const offToggle = window.tgxray.onToggleSettings((open) => {
      setIsOverlayOpen(open)
    })
    const offUnread = window.tgxray.onUnreadCount((count) => {
      setUnreadCount(count)
    })
    const offUpdate = window.tgxray.onUpdateStatus((info) => {
      setUpdateInfo(info)
    })

    return () => {
      offStatus()
      offLog()
      offToggle()
      offUnread()
      offUpdate()
    }
  }, [])

  const handleToggleSettings = async (open?: boolean): Promise<void> => {
    const next = await window.tgxray.toggleSettings(open)
    setIsOverlayOpen(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0e1621', color: '#f5f5f5' }}>
      {/* Top Bar (Height: 44px) */}
      <header
        style={{
          height: 44,
          minHeight: 44,
          maxHeight: 44,
          padding: '0 16px',
          background: '#17212b',
          borderBottom: '1px solid #242f3d',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          userSelect: 'none',
          boxSizing: 'border-box'
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: stateDot(status.state),
            display: 'inline-block',
            boxShadow: `0 0 6px ${stateDot(status.state)}`
          }}
        />
        <strong style={{ fontSize: 13, color: '#fff' }}>Telegram Web</strong>
        {appVersion && (
          <span style={{ fontSize: 11, opacity: 0.6, background: '#242f3d', padding: '1px 5px', borderRadius: 4 }}>
            v{appVersion}
          </span>
        )}
        {unreadCount > 0 && (
          <span
            style={{
              background: '#e74c3c',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              padding: '1px 7px',
              borderRadius: 10,
              lineHeight: '16px'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        <span style={{ fontSize: 12, opacity: 0.75, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {status.state}
          {status.externalIp ? ` (${status.externalIp})` : ''}
          {status.message ? ` — ${status.message}` : ''}
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {updateInfo.status === 'downloaded' && (
            <button
              style={{ fontSize: 12, padding: '4px 10px', background: '#9b59b6', color: '#fff', fontWeight: 600 }}
              onClick={() => void window.tgxray.installUpdate()}
              title="Restart app to apply downloaded update"
            >
              🚀 Install v{updateInfo.version}
            </button>
          )}

          {updateInfo.status === 'downloading' && (
            <span style={{ fontSize: 12, color: '#f1c40f', background: '#242f3d', padding: '3px 8px', borderRadius: 4 }}>
              Downloading update: {updateInfo.progress ?? 0}%
            </span>
          )}

          {updateInfo.status === 'available' && (
            <span style={{ fontSize: 12, color: '#3498db' }}>
              Update v{updateInfo.version} found…
            </span>
          )}

          <button
            style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => void window.tgxray.reloadTg()}
            title="Reload Telegram Web page"
          >
            ↻ Reload TG
          </button>

          {status.state === 'connected' ? (
            <button
              style={{ fontSize: 12, padding: '4px 10px', background: '#c0392b' }}
              onClick={() => void window.tgxray.disconnect().then(setStatus)}
            >
              Disconnect
            </button>
          ) : (
            <button
              style={{ fontSize: 12, padding: '4px 10px', background: '#27ae60' }}
              disabled={status.state === 'connecting'}
              onClick={() => {
                if (profiles.length === 0) {
                  void handleToggleSettings(true)
                } else {
                  void window.tgxray.reconnect().then(setStatus)
                }
              }}
            >
              {status.state === 'connecting' ? 'Connecting…' : 'Connect'}
            </button>
          )}

          <button
            style={{
              fontSize: 12,
              padding: '4px 12px',
              background: isOverlayOpen ? '#5288c1' : '#2b5278',
              color: '#fff',
              fontWeight: 500
            }}
            onClick={() => void handleToggleSettings()}
          >
            {isOverlayOpen ? '✕ Close Settings' : '⚙ Proxy & Settings'}
          </button>
        </div>
      </header>

      {/* Settings / Logs Overlay Panel */}
      {isOverlayOpen ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: '#0e1621'
          }}
        >
          <nav
            style={{
              display: 'flex',
              gap: 8,
              padding: '10px 16px',
              background: '#17212b',
              borderBottom: '1px solid #242f3d'
            }}
          >
            {(['profiles', 'settings', 'logs'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: tab === t ? '#5288c1' : 'transparent',
                  color: tab === t ? '#fff' : '#8291a0',
                  fontWeight: tab === t ? 600 : 400,
                  textTransform: 'capitalize'
                }}
              >
                {t}
              </button>
            ))}
          </nav>
          <main style={{ flex: 1, overflow: 'auto', padding: 20 }}>
            {tab === 'profiles' && (
              <Profiles
                profiles={profiles}
                status={status}
                onChange={refreshProfiles}
                onStatus={setStatus}
              />
            )}
            {tab === 'settings' && settings && (
              <Settings settings={settings} updateInfo={updateInfo} onChange={setSettings} />
            )}
            {tab === 'logs' && <Logs logs={logs} />}
          </main>
        </div>
      ) : (
        status.state !== 'connected' && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0e1621',
              color: '#8291a0',
              padding: 24,
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>
              {status.state === 'connecting' ? '⏳' : status.state === 'error' ? '⚠️' : '🛡️'}
            </div>
            <h2 style={{ color: '#fff', margin: '0 0 8px 0', fontSize: 18 }}>
              {status.state === 'connecting'
                ? 'Connecting to Xray proxy…'
                : status.state === 'error'
                  ? 'Connection Error'
                  : 'Proxy Disconnected'}
            </h2>
            <p style={{ maxWidth: 450, margin: '0 0 16px 0', fontSize: 13, lineHeight: '20px' }}>
              {status.state === 'connecting'
                ? 'Setting up encrypted tunnel. Telegram Web will load automatically.'
                : status.state === 'error'
                  ? (status.message || 'Failed to establish connection. Check proxy settings or server availability.')
                  : profiles.length === 0
                    ? 'No Xray proxy profile configured yet. Add your VLESS/Reality link to get started.'
                    : 'Telegram traffic is blocked or direct access is unavailable. Connect to a proxy profile to access Telegram.'}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              {profiles.length > 0 && status.state !== 'connecting' && (
                <button
                  style={{ background: '#27ae60', color: '#fff', padding: '8px 18px', fontWeight: 600 }}
                  onClick={() => void window.tgxray.reconnect().then(setStatus)}
                >
                  ⚡ Connect Now
                </button>
              )}
              <button
                style={{ background: '#5288c1', color: '#fff', padding: '8px 18px', fontWeight: 600 }}
                onClick={() => void handleToggleSettings(true)}
              >
                ⚙ Open Proxy Settings
              </button>
            </div>
          </div>
        )
      )}
    </div>
  )
}
