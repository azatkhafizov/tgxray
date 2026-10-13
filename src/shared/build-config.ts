import type { LogLevel, ParsedOutbound } from './parse-link'

export interface BuildConfigInput {
  outbound: ParsedOutbound
  socksPort: number
  httpPort: number
  logLevel: LogLevel
}

export function buildXrayClientConfig(input: BuildConfigInput): Record<string, unknown> {
  const { outbound, socksPort, httpPort, logLevel } = input
  const outboundTag = outbound.tag || 'proxy'
  return {
    log: { loglevel: logLevel },
    inbounds: [
      {
        tag: 'socks-in',
        listen: '127.0.0.1',
        port: socksPort,
        protocol: 'socks',
        settings: { auth: 'noauth', udp: true },
        sniffing: { enabled: true, destOverride: ['http', 'tls'] }
      },
      {
        tag: 'http-in',
        listen: '127.0.0.1',
        port: httpPort,
        protocol: 'http',
        settings: {},
        sniffing: { enabled: true, destOverride: ['http', 'tls'] }
      }
    ],
    outbounds: [
      {
        tag: outboundTag,
        protocol: outbound.protocol,
        settings: outbound.settings,
        streamSettings: outbound.streamSettings
      },
      { tag: 'direct', protocol: 'freedom' },
      { tag: 'block', protocol: 'blackhole' }
    ],
    routing: {
      domainStrategy: 'AsIs',
      rules: [
        {
          type: 'field',
          inboundTag: ['socks-in', 'http-in'],
          outboundTag: outboundTag
        }
      ]
    }
  }
}
