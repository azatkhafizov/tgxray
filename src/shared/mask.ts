const UUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g

function maskMiddle(value: string, keep = 4): string {
  if (value.length <= keep * 2) return '***'
  return `${value.slice(0, keep)}***${value.slice(-keep)}`
}

export function maskSecret(input: string): string {
  let out = input.replace(UUID_RE, (m) => maskMiddle(m))
  out = out.replace(/("?(?:password|passwd|pwd|uuid|id|publicKey|public_key|pbk|shortId|short_id|secret|auth)"?\s*[:=]\s*"?)([^"\s,}]+)/gi, (_m, prefix: string, val: string) => {
    return `${prefix}${maskMiddle(val)}`
  })
  out = out.replace(/(vless|vmess|trojan|ss):\/\/[^@\s]+@/gi, (_m, proto: string) => `${proto}://***@`)
  return out
}
