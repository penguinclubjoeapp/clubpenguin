import BaseHandler from './BaseHandler'
import Register from '@plugin/plugins/login/Register'

import type User from '@objects/user/User'

export default class LoginHandler extends BaseHandler {

    registerPlugin: Register

    constructor(
        public id: string,
        public users: Record<string, User>
    ) {
        super(id, users)

        this.logging = false

        this.registerPlugin = new Register(this)
        this.startPlugins('/login')
    }

    async register(args: { username: string; email: string; password: string }) {
        return await this.registerPlugin.register(args)
    }

}
