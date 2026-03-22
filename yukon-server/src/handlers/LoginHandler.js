import BaseHandler from './BaseHandler'
import Register from '@plugin/plugins/login/Register'


export default class LoginHandler extends BaseHandler {

    constructor(id, users, db, config) {
        super(id, users, db, config)

        this.logging = false

        this.startPlugins('/login')

        this.registerPlugin = new Register(this)
    }

    async register(args) {
        return await this.registerPlugin.register(args)
    }

}
