import Plugin from '@plugin/Plugin'

import bcrypt from 'bcrypt'
import Validator from 'fastest-validator'


export default class Register extends Plugin {

    constructor(handler) {
        super(handler)

        this.check = this.createValidator()

        this.responses = {
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
    }

    createValidator() {
        let validator = new Validator()

        let schema = {
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

    async register(args) {
        let check = this.check({
            username: args.username,
            email: args.email,
            password: args.password
        })

        if (check !== true) {
            // Return first validation error with field name as key
            let error = check[0]
            return {
                success: false,
                [error.field]: error.message
            }
        }

        // Check if username is already taken
        let existingUser = await this.db.getUserByUsername(args.username)
        if (existingUser) {
            return this.responses.usernameTaken
        }

        // Hash password
        let hashedPassword = await bcrypt.hash(args.password, 10)

        // Create user
        await this.db.users.create({
            username: args.username,
            password: hashedPassword
        })

        return this.responses.created
    }

}
