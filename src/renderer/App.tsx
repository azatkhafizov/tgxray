import { useEffect, useState } from 'react'
import type { AppSettings, LogEntry, Profile, StatusPayload } from '@shared/types'
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
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])

  const refreshProfiles = async (): Promise<void> => setProfiles(await window.tgxray.listProfiles())

  useEffect(() => {
    void window.tgxray.getStatus().then(setStatus)
    void refreshProfiles()
    void window.tgxray.getSettings().then(setSettings)
    void window.tgxray.getLogs().then(setLogs)

    const offStatus = window.tgxray.onStatus(setStatus)
    const offLog = window.tgxray.onLog((entry) =>
      setLogs((prev) => [...prev.slice(-1999), entry])
    )
    const offToggle = window.tgxray.onToggleSettings((open) => {
      setIsOverlayOpen(open)
    })

    return () => {
      offStatus()
      offLog()
      offToggle()
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
        <strong style={{ fontSize: 13, color: '#fff' }}>Telegram Xray</strong>
        <span style={{ fontSize: 12, opacity: 0.75, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {status.state}
          {status.externalIp ? ` (${status.externalIp})` : ''}
          {status.message ? ` — ${status.message}` : ''}
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
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
      {isOverlayOpen && (
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
              <Settings settings={settings} onChange={setSettings} />
            )}
            {tab === 'logs' && <Logs logs={logs} />}
          </main>
        </div>
      )}
    </div>
  )
}
