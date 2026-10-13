import { useState } from 'react'
import type { Profile, StatusPayload } from '@shared/types'

interface Props {
  profiles: Profile[]
  status: StatusPayload
  onChange: () => Promise<void>
  onStatus: (s: StatusPayload) => void
}

export function Profiles({ profiles, status, onChange, onStatus }: Props): JSX.Element {
  const [name, setName] = useState('')
  const [source, setSource] = useState<'link' | 'file'>('link')
  const [link, setLink] = useState('')

  const paste = async (): Promise<void> => setLink(await window.tgxray.readClipboard())

  const add = async (): Promise<void> => {
    if (!name.trim() || !link.trim()) return
    await window.tgxray.addProfile({ name: name.trim(), source, link: link.trim() })
    setName('')
    setLink('')
    await onChange()
  }

  const connect = async (id: string): Promise<void> => onStatus(await window.tgxray.connect(id))

  const remove = async (id: string): Promise<void> => {
    await window.tgxray.deleteProfile(id)
    await onChange()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section style={{ border: '1px solid #2a2f3a', borderRadius: 8, padding: 12, display: 'grid', gap: 8 }}>
        <strong>Add profile</strong>
        <input placeholder="Profile name" value={name} onChange={(e) => setName(e.target.value)} />
        <select value={source} onChange={(e) => setSource(e.target.value as 'link' | 'file')}>
          <option value="link">Share link</option>
          <option value="file">config.json path</option>
        </select>
        <textarea
          rows={3}
          placeholder={source === 'link' ? 'vless://... / vmess://... / trojan://... / ss://...' : '/path/to/config.json'}
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => void paste()}>Paste from clipboard</button>
          <button onClick={() => void add()} disabled={!name.trim() || !link.trim()}>Add</button>
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {profiles.length === 0 && <p style={{ opacity: 0.6 }}>No profiles yet.</p>}
        {profiles.map((p) => (
          <div key={p.id} style={{ border: '1px solid #2a2f3a', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div><strong>{p.name}</strong> <span style={{ opacity: 0.5 }}>{p.source}</span></div>
              <div style={{ opacity: 0.6, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.source === 'link' ? p.link.replace(/^(\w+:\/\/)[^@]+@/, '$1***@') : p.link}
              </div>
            </div>
            {status.profileId === p.id && status.state === 'connected' ? (
              <button onClick={() => void window.tgxray.disconnect().then(onStatus)}>Disconnect</button>
            ) : (
              <button onClick={() => void connect(p.id)}>Connect</button>
            )}
            <button onClick={() => void remove(p.id)}>Delete</button>
          </div>
        ))}
      </section>
    </div>
  )
}
