import getSocketAddress from '@objects/user/getSocketAddress'
import RateLimiter from '../ratelimit/RateLimiter'
import UserFactory from '@objects/user/UserFactory'

import { RateLimiterRes } from 'rate-limiter-flexible'


export default class Server {

    constructor(id, users, db, handler, config) {
        this.id = id
        this.users = users
        this.db = db
        this.handler = handler
        this.config = config

        const io = this.createIo(config.socketio, {
            cors: {
                origin: config.cors.origin,
                methods: ['GET', 'POST']
            },
            path: '/socket.io'
        }, config.worlds[id].port)

        this.rateLimiter = config.rateLimit.enabled
            ? new RateLimiter(config)
            : null

        this.server = io

        this.server.on('connection', socket => this.onConnection(socket))
    }

    createIo(config, options, port) {
        const server = config.https
            ? this.httpsServer(config.ssl)
            : this.httpServer()

        server.listen(port)

        return require('socket.io')(server, options)
    }

    httpServer() {
        return require('http').createServer((req, res) => {
            if (req.method === 'POST' && req.url === '/api/register') {
                this.handleRegister(req, res)
            }
        })
    }

    handleRegister(req, res) {
        let body = ''

        req.on('data', chunk => {
            body += chunk.toString()
            // Limit body size to 1KB
            if (body.length > 1024) {
                res.writeHead(413, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: false, error: 'Request too large' }))
                req.destroy()
            }
        })

        req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json')

            try {
                let args = JSON.parse(body)
                let result = await this.handler.register(args)
                res.writeHead(200)
                res.end(JSON.stringify(result))
            } catch (error) {
                this.handler.error(error)
                res.writeHead(400)
                res.end(JSON.stringify({ success: false, error: 'Invalid request' }))
            }
        })
    }

    httpsServer(ssl) {
        const fs = require('fs')
        const loaded = {}

        // Loads ssl files
        for (const key in ssl) {
            loaded[key] = fs.readFileSync(ssl[key]).toString()
        }

        return require('https').createServer(loaded)
    }

    async onConnection(socket) {
        try {
            if (this.rateLimiter) {
                const address = getSocketAddress(socket, this.config)

                await this.rateLimiter.addressConnects.consume(address)
            }

            this.initUser(socket)

        } catch (error) {
            if (!(error instanceof RateLimiterRes)) {
                this.handler.error(error)
            }

            socket.disconnect(true)
        }
    }

    initUser(socket) {
        const user = UserFactory(this, socket)

        this.users[socket.id] = user

        console.log(`[${this.id}] Connection from: ${socket.id} ${user.address}`)

        socket.on('message', message => this.onMessage(message, user))
        socket.on('disconnect', () => this.onDisconnect(user))
    }

    async onMessage(message, user) {
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
                this.handler.error(error)
            }
        }
    }

    onDisconnect(user) {
        console.log(`[${this.id}] Disconnect from: ${user.socket.id} ${user.address}`)

        this.handler.close(user)
    }

}
