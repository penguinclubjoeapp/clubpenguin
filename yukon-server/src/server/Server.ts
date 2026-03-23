import { config } from '@config'
import getSocketAddress from '@objects/user/getSocketAddress'
import RateLimiter from '../ratelimit/RateLimiter'
import UserFactory from '@objects/user/UserFactory'

import type BaseHandler from '../handlers/BaseHandler'
import type { Config } from '@config'
import type GameUser from '@objects/user/GameUser'
import type User from '@objects/user/User'

import type { ServerOptions, Socket } from 'socket.io'
import fs from 'fs'
import http from 'http'
import https from 'https'
import { Server as IoServer } from 'socket.io'
import { RateLimiterRes } from 'rate-limiter-flexible'

export type Action = string
export type Args = Record<string, any>

export interface Message {
    action: Action
    args: Args
}

export default class Server {

    rateLimiter: RateLimiter | null
    server: IoServer

    constructor(
        public id: string,
        private users: Record<string, User>,
        public handler: BaseHandler
    ) {

        const io = this.createIo(config.socketio, {
            cors: {
                origin: config.cors.origin,
                methods: ['GET', 'POST']
            },
            path: '/'
        })

        this.rateLimiter = config.rateLimit.enabled
            ? new RateLimiter()
            : null

        this.server = io.listen(config.worlds[id].port)

        this.server.on('connection', socket => this.onConnection(socket))
    }

    createIo({ https, ssl }: Config['socketio'], options: Partial<ServerOptions>) {
        const server = https
            ? this.httpsServer(ssl)
            : this.httpServer()

        return new IoServer(server, options)
    }

    httpServer() {
        return http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
            if (req.method === 'POST' && req.url === '/api/register') {
                this.handleRegister(req, res)
            }
        })
    }

    handleRegister(req: http.IncomingMessage, res: http.ServerResponse) {
        let body = ''

        req.on('data', (chunk: Buffer) => {
            body += chunk.toString()

            if (body.length > 1024) {
                res.writeHead(413, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: false, error: 'Request too large' }))
                req.destroy()
            }
        })

        req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json')

            try {
                const args = JSON.parse(body)
                const result = await (this.handler as any).register(args)
                res.writeHead(200)
                res.end(JSON.stringify(result))
            } catch (error) {
                if (error instanceof Error) {
                    this.handler.error(error)
                }
                res.writeHead(400)
                res.end(JSON.stringify({ success: false, error: 'Invalid request' }))
            }
        })
    }

    httpsServer(ssl: Config['socketio']['ssl']) {
        const loaded: Record<string, string> = {}

        // Loads ssl files
        for (const key in ssl) {
            loaded[key] = fs.readFileSync(ssl[key as keyof typeof ssl]).toString()
        }

        return https.createServer(loaded)
    }

    async onConnection(socket: Socket) {
        try {
            if (this.rateLimiter) {
                const address = getSocketAddress(socket)

                await this.rateLimiter.addressConnects.consume(address)
            }

            this.initUser(socket)

        } catch (error) {
            if (!(error instanceof RateLimiterRes)) {
                // @ts-expect-error temp
                this.handler.error(error)
            }

            socket.disconnect(true)
        }
    }

    initUser(socket: Socket) {
        const user = UserFactory(this, socket)

        this.users[socket.id] = user

        console.log(`[${this.id}] Connection from: ${socket.id} ${user.address}`)

        socket.on('message', message => this.onMessage(message, user))
        socket.on('disconnect', () => this.onDisconnect(user))
    }

    async onMessage(message: Message, user: User | GameUser) {
        if (this.handler.isOnCooldown(message, user)) {
            return
        }

        try {
            if (this.rateLimiter) {
                await this.rateLimiter.addressEvents.consume(user.address)
                await this.rateLimiter.userEvents.consume(user.getId())
            }

            this.handler.handle(message, user)

        } catch (error) {
            if (!(error instanceof RateLimiterRes)) {
                // @ts-expect-error temp
                this.handler.error(error)
            }
        }
    }

    onDisconnect(user: User | GameUser) {
        console.log(`[${this.id}] Disconnect from: ${user.socket.id} ${user.address}`)

        this.handler.close(user)
    }

}
