import Plugin from '@plugin/Plugin'

import Database from '@database/Database'
import type LoginHandler from '../../../handlers/LoginHandler'

import Validator, { type AsyncCheckFunction, type SyncCheckFunction } from 'fastest-validator'
import bcrypt from 'bcrypt'

const responses = {
    usernameTaken: {
        success: false,
        username: 'That penguin name is already taken. Try another name.'
    },
    invalidEmail: {
        success: false,
        email: 'Please enter a valid email address.'
    },
    created: {
        success: true
    }
}

interface RegisterArgs {
    username: string
    email: string
    password: string
}

export default class Register extends Plugin {

    check: AsyncCheckFunction | SyncCheckFunction

    constructor(handler: LoginHandler) {
        super(handler)

        this.check = this.createValidator()
    }

    createValidator() {
        const validator = new Validator()

        const schema = {
            username: {
                empty: false,
                trim: true,
                type: 'string',
                min: 4,
                max: 12,
                pattern: /^[a-zA-Z0-9 ]+$/,
                messages: {
                    stringEmpty: 'You must provide a Penguin Name',
                    stringMin: 'Your Penguin Name must be at least 4 characters',
                    stringMax: 'Your Penguin Name cannot exceed 12 characters',
                    stringPattern: 'Your Penguin Name can only contain letters, numbers, and spaces'
                }
            },
            email: {
                empty: false,
                trim: true,
                type: 'email',
                max: 254,
                messages: {
                    stringEmpty: 'You must provide an email address',
                    email: 'Please enter a valid email address',
                    stringMax: 'Email address is too long'
                }
            },
            password: {
                empty: false,
                type: 'string',
                min: 8,
                max: 60,
                messages: {
                    stringEmpty: 'You must provide a password',
                    stringMin: 'Your password must be at least 8 characters',
                    stringMax: 'Your password cannot exceed 60 characters'
                }
            }
        }

        return validator.compile(schema)
    }

    async register(args: RegisterArgs) {
        const check = this.check({
            username: args.username,
            email: args.email,
            password: args.password
        })

        if (check !== true) {
            const error = (check as any[])[0]
            return {
                success: false,
                [error.field]: error.message
            }
        }

        const existingUser = await Database.user.findFirst({
            where: { username: args.username }
        })

        if (existingUser) {
            return responses.usernameTaken
        }

        const hashedPassword = await bcrypt.hash(args.password, 10)

        await Database.user.create({
            data: {
                username: args.username,
                password: hashedPassword
            }
        })

        return responses.created
    }

}
