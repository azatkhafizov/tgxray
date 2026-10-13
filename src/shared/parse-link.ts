export type Protocol = 'vless' | 'vmess' | 'trojan' | 'shadowsocks'
export type LogLevel = 'error' | 'warning' | 'info' | 'debug'

export interface ParsedOutbound {
  protocol: Protocol
  tag: string
  address: string
  port: number
  rawLink: string
  settings: Record<string, unknown>
  streamSettings: Record<string, unknown>
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function parseQuery(query: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const pair of query.split('&')) {
    if (!pair) continue
    const idx = pair.indexOf('=')
    const key = idx >= 0 ? pair.slice(0, idx) : pair
    const val = idx >= 0 ? pair.slice(idx + 1) : ''
    out[safeDecode(key)] = safeDecode(val)
  }
  return out
}

function splitHostPort(authority: string): { address: string; port: number } {
  const clean = authority.replace(/^\[|\]$/g, '')
  const idx = clean.lastIndexOf(':')
  if (idx < 0) return { address: clean, port: 0 }
  return { address: clean.slice(0, idx), port: Number(clean.slice(idx + 1)) || 0 }
}

function buildStreamSettings(params: Record<string, string>): Record<string, unknown> {
  const rawType = (params.type || 'tcp').toLowerCase()
  // Support both 'xhttp' and 'splithttp'
  const network = rawType === 'splithttp' || rawType === 'xhttp' ? 'xhttp' : rawType
  const stream: Record<string, unknown> = { network }
  const security = params.security || 'none'

  if (security === 'tls') {
    stream.security = 'tls'
    const tls: Record<string, unknown> = {}
    if (params.sni || params.host) tls.serverName = params.sni || params.host
    if (params.fp) tls.fingerprint = params.fp
    if (params.alpn) tls.alpn = params.alpn.split(',').map((s) => s.trim()).filter(Boolean)
    if (params.allowInsecure === '1' || params.allowInsecure === 'true') tls.allowInsecure = true
    stream.tlsSettings = tls
  } else if (security === 'reality') {
    stream.security = 'reality'
    const reality: Record<string, unknown> = {}
    if (params.sni || params.host) reality.serverName = params.sni || params.host
    if (params.fp) reality.fingerprint = params.fp
    if (params.pbk) reality.publicKey = params.pbk
    if (params.sid) reality.shortId = params.sid
    if (params.spx) reality.spiderX = params.spx
    stream.realitySettings = reality
  }

  if (network === 'ws') {
    stream.wsSettings = {
      path: params.path || '/',
      headers: params.host ? { Host: params.host } : undefined
    }
  } else if (network === 'xhttp') {
    const xhttp: Record<string, unknown> = {
      path: params.path || '/'
    }
    if (params.host) xhttp.host = params.host
    if (params.mode) xhttp.mode = params.mode
    stream.xhttpSettings = xhttp
  } else if (network === 'grpc') {
    stream.grpcSettings = { serviceName: params.serviceName || params.path || '' }
  } else if (network === 'h2') {
    stream.httpSettings = { path: params.path || '/', host: params.host ? [params.host] : undefined }
  } else if (network === 'tcp') {
    if (params.headerType === 'http') {
      stream.tcpSettings = {
        header: { type: 'http', request: { path: [params.path || '/'], headers: params.host ? { Host: [params.host] } : {} } }
      }
    }
  }
  return stream
}

export function parseVless(url: string): ParsedOutbound {
  const u = new URL(url)
  const params = parseQuery(u.search.slice(1))
  const { address, port } = { address: u.hostname, port: Number(u.port) || 443 }
  const id = safeDecode(u.username)
  const user: Record<string, unknown> = {
    id,
    encryption: params.encryption || 'none'
  }
  if (params.flow) user.flow = params.flow

  const settings = {
    vnext: [
      {
        address,
        port,
        users: [user]
      }
    ]
  }
  return {
    protocol: 'vless',
    tag: safeDecode(u.hash.slice(1)) || 'proxy',
    address,
    port,
    rawLink: url,
    settings,
    streamSettings: buildStreamSettings(params)
  }
}

export function parseVmess(url: string): ParsedOutbound {
  const raw = url.slice('vmess://'.length)
  let decoded: string
  try {
    decoded = Buffer.from(raw, 'base64').toString('utf-8')
  } catch {
    throw new Error('vmess: invalid base64')
  }
  const json = JSON.parse(decoded) as Record<string, unknown>
  const address = String(json.add ?? '')
  const port = Number(json.port ?? 443)
  const settings = {
    vnext: [
      {
        address,
        port,
        users: [
          {
            id: String(json.id ?? ''),
            alterId: Number(json.aid ?? 0),
            security: String(json.scy ?? 'auto')
          }
        ]
      }
    ]
  }
  const params: Record<string, string> = {
    security: String(json.tls ?? '') === 'tls' ? 'tls' : 'none',
    type: String(json.net ?? 'tcp'),
    host: String(json.host ?? ''),
    path: String(json.path ?? '/'),
    sni: String(json.sni ?? '')
  }
  return {
    protocol: 'vmess',
    tag: String(json.ps ?? 'proxy'),
    address,
    port,
    rawLink: url,
    settings,
    streamSettings: buildStreamSettings(params)
  }
}

export function parseTrojan(url: string): ParsedOutbound {
  const u = new URL(url)
  const params = parseQuery(u.search.slice(1))
  const address = u.hostname
  const port = Number(u.port) || 443
  const settings = {
    servers: [
      {
        address,
        port,
        password: safeDecode(u.username)
      }
    ]
  }
  const stream = buildStreamSettings({ ...params, security: params.security || 'tls' })
  return {
    protocol: 'trojan',
    tag: safeDecode(u.hash.slice(1)) || 'proxy',
    address,
    port,
    rawLink: url,
    settings,
    streamSettings: stream
  }
}

export function parseShadowsocks(url: string): ParsedOutbound {
  const withoutScheme = url.slice('ss://'.length)
  const hashIdx = withoutScheme.indexOf('#')
  const tag = hashIdx >= 0 ? safeDecode(withoutScheme.slice(hashIdx + 1)) : 'proxy'
  const core = hashIdx >= 0 ? withoutScheme.slice(0, hashIdx) : withoutScheme
  const queryIdx = core.indexOf('?')
  const main = queryIdx >= 0 ? core.slice(0, queryIdx) : core

  let method = ''
  let password = ''
  let address = ''
  let port = 0

  if (main.includes('@')) {
    const [userinfo, authority] = main.split('@')
    const cred = userinfo.includes(':') ? userinfo : Buffer.from(userinfo, 'base64').toString('utf-8')
    const ci = cred.indexOf(':')
    method = ci >= 0 ? cred.slice(0, ci) : cred
    password = ci >= 0 ? cred.slice(ci + 1) : ''
    const hp = splitHostPort(authority)
    address = hp.address
    port = hp.port
  } else {
    const decoded = Buffer.from(main, 'base64').toString('utf-8')
    const at = decoded.lastIndexOf('@')
    const cred = decoded.slice(0, at)
    const ci = cred.indexOf(':')
    method = ci >= 0 ? cred.slice(0, ci) : cred
    password = ci >= 0 ? cred.slice(ci + 1) : ''
    const hp = splitHostPort(decoded.slice(at + 1))
    address = hp.address
    port = hp.port
  }

  const settings = {
    servers: [{ address, port, method, password }]
  }
  return {
    protocol: 'shadowsocks',
    tag,
    address,
    port,
    rawLink: url,
    settings,
    streamSettings: { network: 'tcp' }
  }
}

export function parseShareLink(link: string): ParsedOutbound {
  const trimmed = link.trim()
  if (trimmed.startsWith('vless://')) return parseVless(trimmed)
  if (trimmed.startsWith('vmess://')) return parseVmess(trimmed)
  if (trimmed.startsWith('trojan://')) return parseTrojan(trimmed)
  if (trimmed.startsWith('ss://')) return parseShadowsocks(trimmed)
  throw new Error('unsupported share link scheme')
}
