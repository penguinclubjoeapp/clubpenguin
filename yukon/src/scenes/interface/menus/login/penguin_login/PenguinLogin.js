import BaseScene from '@scenes/base/BaseScene'

import { Animation, Button, SimpleButton } from '@components/components'
import TextInput from '@engine/interface/text/TextInput'

import Checks from '../checks/Checks'
import PenguinLarge from '../card/PenguinLarge'
import WaitPrompt from '../prompts/WaitPrompt'
import SavePrompt from '../prompts/SavePrompt'

/* START OF COMPILED CODE */

export default class PenguinLogin extends BaseScene {

    constructor() {
        super("PenguinLogin");

        /** @type {PenguinLarge} */
        this.container;
        /** @type {Checks} */
        this.checks;
        /** @type {SavePrompt} */
        this.savePrompt;
        /** @type {WaitPrompt} */
        this.waitPrompt;


        /* START-USER-CTR-CODE */
        /* END-USER-CTR-CODE */
    }

    /** @returns {void} */
    _create() {

        // bg
        const bg = this.add.image(0, 0, "load", "bg");
        bg.setOrigin(0, 0);

        // ── Glass panel ──────────────────────────────────────
        const panel = this.add.graphics();
        const px = 710, py = 140, pw = 490, ph = 580, pr = 20;

        // Drop shadow
        panel.fillStyle(0x000000, 0.28);
        panel.fillRoundedRect(px + 5, py + 5, pw, ph, pr);

        // Panel body – translucent blue
        panel.fillStyle(0x0B5DA8, 0.80);
        panel.fillRoundedRect(px, py, pw, ph, pr);

        // Top glass highlight
        panel.fillStyle(0x6BD4FF, 0.14);
        panel.fillRoundedRect(px + 6, py + 3, pw - 12, 90, { tl: pr - 3, tr: pr - 3, bl: 0, br: 0 });

        // Top edge glow
        panel.fillStyle(0xBBEEFF, 0.08);
        panel.fillRoundedRect(px + 25, py + 3, pw - 50, 30, { tl: pr - 3, tr: pr - 3, bl: 0, br: 0 });

        // Outer border
        panel.lineStyle(2.5, 0x6EC4E6, 0.50);
        panel.strokeRoundedRect(px, py, pw, ph, pr);

        // Inner border highlight
        panel.lineStyle(1, 0xAADDFF, 0.12);
        panel.strokeRoundedRect(px + 4, py + 4, pw - 8, ph - 8, pr - 2);

        // container
        const container = new PenguinLarge(this, 475, 430);
        this.add.existing(container);

        // backButton
        const backButton = this.add.sprite(760, 876, "login", "larger-button");

        // forgetButton
        const forgetButton = this.add.sprite(955, 661, "login", "small-button");

        // forgotButton
        const forgotButton = this.add.sprite(955, 604, "login", "small-button");

        // backText
        const backText = this.add.text(760, 876, "", {});
        backText.setOrigin(0.5, 0.5);
        backText.text = "Login as a different penguin";
        backText.setStyle({ "align": "center", "color": "#FFFFFF", "fixedWidth":400, "fontFamily": "Arial", "fontStyle": "bold", "fontSize": "28px" });
        backText.setShadow(1, 1, 'rgba(0,0,0,0.3)', 3);

        // forgotText_1
        const forgotText_1 = this.add.text(929, 661, "", {});
        forgotText_1.setOrigin(0.5, 0.5);
        forgotText_1.text = "Forget my penguin";
        forgotText_1.setStyle({ "color": "#FFFFFF", "fixedWidth":300, "fontFamily": "Arial", "fontStyle": "bold", "fontSize": "28px" });
        forgotText_1.setShadow(1, 1, 'rgba(0,0,0,0.3)', 3);

        // forgotText
        const forgotText = this.add.text(929, 604, "", {});
        forgotText.setOrigin(0.5, 0.5);
        forgotText.text = "Forgot your password?";
        forgotText.setStyle({ "color": "#FFFFFF", "fixedWidth":300, "fontFamily": "Arial", "fontStyle": "bold", "fontSize": "28px" });
        forgotText.setShadow(1, 1, 'rgba(0,0,0,0.3)', 3);

        // loginButton
        const loginButton = this.add.sprite(935, 487, "login", "login-button");

        // loginText
        const loginText = this.add.text(935, 487, "", {});
        loginText.setOrigin(0.5, 0.5);
        loginText.text = "Log In";
        loginText.setStyle({ "align": "center", "color": "#FFFFFF", "fixedWidth":100, "fontFamily": "Arial", "fontStyle": "bold", "fontSize": "36px" });
        loginText.setShadow(1, 2, 'rgba(0,0,0,0.35)', 4);

        // passwordText
        const passwordText = this.add.text(783, 194, "", {});
        passwordText.setOrigin(0, 0.5);
        passwordText.text = "Password:";
        passwordText.setStyle({ "color": "#FFFFFFEE", "fontFamily": "Arial", "fontStyle": "bold", "fontSize": "28px" });
        passwordText.setShadow(1, 1, 'rgba(0,0,0,0.3)', 3);

        // ── Rounded input background ──
        const inputGfx = this.add.graphics();
        inputGfx.fillStyle(0xFFFFFF, 0.92);
        inputGfx.fillRoundedRect(783, 223, 380, 53, 10);
        inputGfx.lineStyle(1.5, 0x0066AA, 0.30);
        inputGfx.strokeRoundedRect(783, 223, 380, 53, 10);

        // Inner shadow
        inputGfx.fillStyle(0x0055AA, 0.06);
        inputGfx.fillRoundedRect(783, 223, 380, 10, { tl: 10, tr: 10, bl: 0, br: 0 });

        // note
        this.add.image(1258, 760, "login", "note");

        // checks
        const checks = new Checks(this, 806, 330);
        this.add.existing(checks);

        // savePrompt
        const savePrompt = new SavePrompt(this, 760, 480);
        this.add.existing(savePrompt);
        savePrompt.visible = false;

        // waitPrompt
        const waitPrompt = new WaitPrompt(this, 760, 480);
        this.add.existing(waitPrompt);
        waitPrompt.visible = false;

        // backButton (components)
        const backButtonSimpleButton = new SimpleButton(backButton);
        backButtonSimpleButton.callback = () => this.onBackClick();
        const backButtonAnimation = new Animation(backButton);
        backButtonAnimation.key = "small-button";
        backButtonAnimation.end = 3;
        backButtonAnimation.repeat = 0;
        backButtonAnimation.onHover = true;

        // forgetButton (components)
        const forgetButtonSimpleButton = new SimpleButton(forgetButton);
        forgetButtonSimpleButton.callback = () => this.onForgetClick();
        const forgetButtonAnimation = new Animation(forgetButton);
        forgetButtonAnimation.key = "small-button";
        forgetButtonAnimation.end = 3;
        forgetButtonAnimation.repeat = 0;
        forgetButtonAnimation.onHover = true;

        // forgotButton (components)
        new SimpleButton(forgotButton);
        const forgotButtonAnimation = new Animation(forgotButton);
        forgotButtonAnimation.key = "small-button";
        forgotButtonAnimation.end = 3;
        forgotButtonAnimation.repeat = 0;
        forgotButtonAnimation.onHover = true;

        // loginButton (components)
        const loginButtonButton = new Button(loginButton);
        loginButtonButton.spriteName = "login-button";
        loginButtonButton.callback = () => this.onLoginSubmit();

        this.container = container;
        this.checks = checks;
        this.savePrompt = savePrompt;
        this.waitPrompt = waitPrompt;

        this.events.emit("scene-awake");
    }


    /* START-USER-CODE */

    create(data) {
        this._create()

        this.network.lastLoginScene = 'PenguinLogin'

        // Todo: change to depth component
        this.waitPrompt.depth = 1
        this.savePrompt.depth = 1

        this.checks.enable(this.checks.username)

        // Penguin
        this.penguin = data.penguin
        this.container.paperDoll.loadDoll(this.penguin)
        this.container.username.text = this.penguin.username.toUpperCase()
        this.container.button.callback = () => this.onBackClick(this.penguin)

        // Login form
        let style = {
            width: 380,
            height: 53,
            padding: '0 12px',
            filter: 'none',
            fontFamily: 'Asterisk',
            fontSize: 35,
            color: '#000',
            borderRadius: '10px'
        }

        this.passwordInput = new TextInput(this, 973, 250, 'password', style, () => this.onLoginSubmit(), 128, false)
        this.add.existing(this.passwordInput)

        // Token
        let token = this.network.getToken(this.penguin.username)
        this.passwordEdited = false

        if (token) {
            this.passwordInput.setText('password')
            // Update password edited on password input
            this.passwordInput.node.addEventListener('keydown', () => this.passwordEdited = true, { once: true })

            this.checks.enable(this.checks.password)
        }

        // Input
        this.input.keyboard.on('keydown-ENTER', () => this.onLoginSubmit())
    }


    onLoginSubmit() {
        let username = this.penguin.username
        let password = this.passwordInput.text
        let token = this.network.getToken(username)
        let onConnect

        this.interface.showLoading(`Logging in ${username}`)
        this.scene.stop()

        if (token && !this.passwordEdited) {
            onConnect = () => this.network.send('token_login', { username: username, token: token })
        } else {
            onConnect = () => this.network.send('login', { username: username, password: password })
        }

        this.network.connectLogin(this.checks.username.checked, this.checks.password.checked, onConnect)
    }

    onForgetClick() {
        let savedPenguins = this.network.savedPenguins

        delete savedPenguins[this.penguin.username.toLowerCase()]
        localStorage.setItem('saved_penguins', JSON.stringify(savedPenguins))

        this.scene.start('PenguinSelect')
    }

    onBackClick() {
        this.network.disconnect()
        this.scene.start('PenguinSelect')
    }

    /* END-USER-CODE */
}

/* END OF COMPILED CODE */
