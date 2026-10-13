import { createServer, type Server, type Socket } from 'net'
import { connect as tcpConnect } from 'net'
import type { Logger } from './logger'

interface SocksAuth {
  username?: string
  password?: string
}

function parseSocksTarget(host: string): { type: number; addr: Buffer } {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return { type: 0x01, addr: Buffer.from(host.split('.').map((n) => Number(n))) }
  }
  const name = Buffer.from(host, 'utf-8')
  return { type: 0x03, addr: Buffer.concat([Buffer.from([name.length]), name]) }
}

function socks5Handshake(socket: Socket, targetHost: string, targetPort: number, auth?: SocksAuth): Promise<void> {
  return new Promise((resolve, reject) => {
    const methods = auth?.username ? [0x00, 0x02] : [0x00]
    socket.write(Buffer.from([0x05, methods.length, ...methods]))
    let phase: 'method' | 'auth' | 'connect' = 'method'
    let buf = Buffer.alloc(0)

    const onData = (chunk: Buffer): void => {
      buf = Buffer.concat([buf, chunk])
      if (phase === 'method') {
        if (buf.length < 2) return
        const method = buf[1]
        buf = buf.slice(2)
        if (method === 0xff) {
          cleanup()
          reject(new Error('socks5: no acceptable auth method'))
          return
        }
        if (method === 0x02) {
          if (!auth?.username) {
            cleanup()
            reject(new Error('socks5: server requires auth but none provided'))
            return
          }
          const u = Buffer.from(auth.username, 'utf-8')
          const p = Buffer.from(auth.password ?? '', 'utf-8')
          socket.write(Buffer.concat([Buffer.from([0x01, u.length]), u, Buffer.from([p.length]), p]))
          phase = 'auth'
          return
        }
        sendConnect()
        return
      }
      if (phase === 'auth') {
        if (buf.length < 2) return
        const ok = buf[1] === 0x00
        buf = buf.slice(2)
        if (!ok) {
          cleanup()
          reject(new Error('socks5: auth failed'))
          return
        }
        sendConnect()
        return
      }
      if (phase === 'connect') {
        if (buf.length < 4) return
        const rep = buf[1]
        cleanup()
        if (rep !== 0x00) reject(new Error(`socks5: connect failed (code ${rep})`))
        else resolve()
      }
    }

    const cleanup = (): void => {
      socket.removeListener('data', onData)
      socket.removeListener('error', onError)
    }
    const onError = (err: Error): void => {
      cleanup()
      reject(err)
    }

    function sendConnect(): void {
      phase = 'connect'
      const { type, addr } = parseSocksTarget(targetHost)
      const portBuf = Buffer.from([(targetPort >> 8) & 0xff, targetPort & 0xff])
      socket.write(Buffer.concat([Buffer.from([0x05, 0x01, 0x00, type]), addr, portBuf]))
    }

    socket.on('data', onData)
    socket.on('error', onError)
  })
}

export interface ProxyBridgeOptions {
  socksHost: string
  socksPort: number
  auth?: SocksAuth
  logger: Logger
}

export class ProxyBridge {
  private server: Server | null = null
  private options: ProxyBridgeOptions
  private port = 0

  constructor(options: ProxyBridgeOptions) {
    this.options = options
  }

  get httpPort(): number {
    return this.port
  }

  get proxyRules(): string {
    return `http://127.0.0.1:${this.port}`
  }

  private handleConnect(client: Socket, target: string): void {
    const [host, portStr] = target.split(':')
    const port = Number(portStr) || 443
    const upstream = tcpConnect({ host: this.options.socksHost, port: this.options.socksPort }, () => {
      socks5Handshake(upstream, host, port, this.options.auth)
        .then(() => {
          client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
          client.pipe(upstream)
          upstream.pipe(client)
        })
        .catch((err) => {
          this.options.logger.error('app', `proxy CONNECT failed: ${err.message}`)
          client.end('HTTP/1.1 502 Bad Gateway\r\n\r\n')
          upstream.destroy()
        })
    })
    upstream.on('error', () => client.destroy())
    client.on('error', () => upstream.destroy())
  }

  start(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = createServer((socket) => {
        socket.once('data', (chunk) => {
          const header = chunk.toString('utf-8')
          const firstLine = header.split('\r\n')[0]
          const [method, target] = firstLine.split(' ')
          if (method === 'CONNECT') {
            this.handleConnect(socket, target)
          } else {
            socket.end('HTTP/1.1 405 Method Not Allowed\r\n\r\n')
          }
        })
        socket.on('error', () => undefined)
      })
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address()
        this.port = typeof addr === 'object' && addr ? addr.port : 0
        this.server = server
        this.options.logger.info('app', `http->socks bridge listening on 127.0.0.1:${this.port}`)
        resolve(this.port)
      })
    })
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) return resolve()
      const server = this.server
      this.server = null
      server.close(() => resolve())
    })
  }
}
