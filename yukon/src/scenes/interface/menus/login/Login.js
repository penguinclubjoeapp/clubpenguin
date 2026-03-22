import BaseScene from '@scenes/base/BaseScene'

import { Animation, Button, SimpleButton } from '@components/components'
import TextInput from '@engine/interface/text/TextInput'

import Checks from './checks/Checks'
import WaitPrompt from './prompts/WaitPrompt'
import SavePrompt from './prompts/SavePrompt'


/* START OF COMPILED CODE */

export default class Login extends BaseScene {

    constructor() {
        super("Login");

        /** @type {Checks} */
        this.checks;
        /** @type {WaitPrompt} */
        this.waitPrompt;
        /** @type {SavePrompt} */
        this.savePrompt;


        /* START-USER-CTR-CODE */
        /* END-USER-CTR-CODE */
    }

    /** @returns {void} */
    _create() {

        // bg
        const bg = this.add.image(0, 1, "load", "bg");
        bg.setOrigin(0, 0);

        // ── Glass panel ──────────────────────────────────────
        const panel = this.add.graphics();
        const px = 430, py = 118, pw = 660, ph = 800, pr = 22;

        // Drop shadow
        panel.fillStyle(0x000000, 0.28);
        panel.fillRoundedRect(px + 5, py + 5, pw, ph, pr);

        // Panel body – translucent blue
        panel.fillStyle(0x0B5DA8, 0.80);
        panel.fillRoundedRect(px, py, pw, ph, pr);

        // Top glass highlight
        panel.fillStyle(0x6BD4FF, 0.14);
        panel.fillRoundedRect(px + 6, py + 3, pw - 12, 100, { tl: pr - 3, tr: pr - 3, bl: 0, br: 0 });

        // Top edge glow
        panel.fillStyle(0xBBEEFF, 0.08);
        panel.fillRoundedRect(px + 30, py + 3, pw - 60, 35, { tl: pr - 3, tr: pr - 3, bl: 0, br: 0 });

        // Outer border
        panel.lineStyle(2.5, 0x6EC4E6, 0.50);
        panel.strokeRoundedRect(px, py, pw, ph, pr);

        // Inner border highlight
        panel.lineStyle(1, 0xAADDFF, 0.12);
        panel.strokeRoundedRect(px + 4, py + 4, pw - 8, ph - 8, pr - 2);

        // ── Header ──
        const headerText = this.add.text(760, 155, "", {});
        headerText.setOrigin(0.5, 0.5);
        headerText.text = "Log In";
        headerText.setStyle({
            fontFamily: "Arial",
            fontSize: "44px",
            fontStyle: "bold",
            color: "#FFFFFF",
            stroke: "#0A4A80",
            strokeThickness: 4
        });
        headerText.setShadow(2, 2, 'rgba(0,0,0,0.35)', 5);

        // ── Rounded input backgrounds ──
        const inputGfx = this.add.graphics();

        // Username input
        inputGfx.fillStyle(0xFFFFFF, 0.92);
        inputGfx.fillRoundedRect(625, 174, 380, 53, 10);
        inputGfx.lineStyle(1.5, 0x0066AA, 0.30);
        inputGfx.strokeRoundedRect(625, 174, 380, 53, 10);

        // Username inner shadow
        inputGfx.fillStyle(0x0055AA, 0.06);
        inputGfx.fillRoundedRect(625, 174, 380, 10, { tl: 10, tr: 10, bl: 0, br: 0 });

        // Password input
        inputGfx.fillStyle(0xFFFFFF, 0.92);
        inputGfx.fillRoundedRect(625, 232, 380, 53, 10);
        inputGfx.lineStyle(1.5, 0x0066AA, 0.30);
        inputGfx.strokeRoundedRect(625, 232, 380, 53, 10);

        // Password inner shadow
        inputGfx.fillStyle(0x0055AA, 0.06);
        inputGfx.fillRoundedRect(625, 232, 380, 10, { tl: 10, tr: 10, bl: 0, br: 0 });

        // backButton
        const backButton = this.add.sprite(760, 876, "login", "small-button");

        // createButton
        const createButton = this.add.sprite(760, 728, "login", "large-button");

        // forgotButton
        const forgotButton = this.add.sprite(760, 604, "login", "small-button");

        // note
        this.add.image(1182, 556, "login", "note");

        // backText
        const backText = this.add.text(760, 876, "", {});
        backText.setOrigin(0.5, 0.5);
        backText.text = "Back";
        backText.setStyle({ "align": "center", "color": "#FFFFFF", "fontFamily": "Arial", "fontStyle": "bold", "fontSize": "28px" });
        backText.setShadow(1, 1, 'rgba(0,0,0,0.3)', 3);

        // registerText2
        const registerText2 = this.add.text(760, 747, "", {});
        registerText2.setOrigin(0.5, 0.5);
        registerText2.text = "Create a free account now";
        registerText2.setStyle({ "align": "center", "color": "#FFFFFF", "fontFamily": "Arial", "fontStyle": "bold", "fontSize": "32px" });
        registerText2.setShadow(1, 1, 'rgba(0,0,0,0.3)', 3);

        // registerText
        const registerText = this.add.text(760, 713, "", {});
        registerText.setOrigin(0.5, 0.5);
        registerText.text = "Don't have a penguin?";
        registerText.setStyle({ "align": "center", "color": "#CCE4F5", "fontFamily": "Arial", "fontSize": "26px" });
        registerText.setShadow(1, 1, 'rgba(0,0,0,0.2)', 2);

        // forgotText
        const forgotText = this.add.text(760, 604, "", {});
        forgotText.setOrigin(0.5, 0.5);
        forgotText.text = "Forgot your password?";
        forgotText.setStyle({ "align": "center", "color": "#FFFFFF", "fontFamily": "Arial", "fontStyle": "bold", "fontSize": "28px" });
        forgotText.setShadow(1, 1, 'rgba(0,0,0,0.3)', 3);

        // loginButton
        const loginButton = this.add.sprite(760, 483, "login", "login-button");

        // loginText
        const loginText = this.add.text(760, 483, "", {});
        loginText.setOrigin(0.5, 0.5);
        loginText.text = "Log In";
        loginText.setStyle({ "align": "center", "color": "#FFFFFF", "fontFamily": "Arial", "fontStyle": "bold", "fontSize": "36px" });
        loginText.setShadow(1, 2, 'rgba(0,0,0,0.35)', 4);

        // passwordText
        const passwordText = this.add.text(618, 258, "", {});
        passwordText.setOrigin(1, 0.5);
        passwordText.text = "Password:";
        passwordText.setStyle({ "color": "#FFFFFFEE", "fontFamily": "Arial", "fontStyle": "bold", "fontSize": "28px" });
        passwordText.setShadow(1, 1, 'rgba(0,0,0,0.3)', 3);

        // usernameText
        const usernameText = this.add.text(618, 200, "", {});
        usernameText.setOrigin(1, 0.5);
        usernameText.text = "Penguin Name:";
        usernameText.setStyle({ "color": "#FFFFFFEE", "fontFamily": "Arial", "fontStyle": "bold", "fontSize": "28px" });
        usernameText.setShadow(1, 1, 'rgba(0,0,0,0.3)', 3);

        // checks
        const checks = new Checks(this, 568, 328);
        this.add.existing(checks);

        // waitPrompt
        const waitPrompt = new WaitPrompt(this, 760, 480);
        this.add.existing(waitPrompt);
        waitPrompt.visible = false;

        // savePrompt
        const savePrompt = new SavePrompt(this, 760, 480);
        this.add.existing(savePrompt);
        savePrompt.visible = false;

        // backButton (components)
        const backButtonSimpleButton = new SimpleButton(backButton);
        backButtonSimpleButton.callback = () => this.onBackClick();
        const backButtonAnimation = new Animation(backButton);
        backButtonAnimation.key = "small-button";
        backButtonAnimation.end = 3;
        backButtonAnimation.repeat = 0;
        backButtonAnimation.onHover = true;

        // createButton (components)
        const createButtonSimpleButton = new SimpleButton(createButton);
        createButtonSimpleButton.callback = () => this.onCreateClick();
        const createButtonAnimation = new Animation(createButton);
        createButtonAnimation.key = "large-button";
        createButtonAnimation.end = 3;
        createButtonAnimation.repeat = 0;
        createButtonAnimation.onHover = true;

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

        this.checks = checks;
        this.waitPrompt = waitPrompt;
        this.savePrompt = savePrompt;

        this.events.emit("scene-awake");
    }


    /* START-USER-CODE */

    create() {
        this._create()

        this.network.lastLoginScene = 'Login'

        // Todo: change to depth component
        this.waitPrompt.depth = 1
        this.savePrompt.depth = 1

        // Login form
        let style = {
            width: 380,
            height: 53,
            padding: '0 12px',
            filter: 'none',
            fontFamily: 'Arial',
            fontSize: 35,
            color: '#000',
            borderRadius: '10px'
        }

        let passwordStyle = {
            ...style,
            fontFamily: 'Asterisk'
        }

        this.usernameInput = new TextInput(this, 815, 200, 'text', style, () => this.onLoginSubmit(), 12, false)
        this.passwordInput = new TextInput(this, 815, 259, 'password', passwordStyle, () => this.onLoginSubmit(), 128, false)

        this.add.existing(this.usernameInput)
        this.add.existing(this.passwordInput)

        // Input
        this.input.keyboard.on('keydown-ENTER', () => this.onLoginSubmit())
    }

    onLoginSubmit() {
        let username = this.usernameInput.text
        let password = this.passwordInput.text

        this.interface.showLoading(`Logging in ${username}`)
        this.scene.stop()

        this.network.connectLogin(this.checks.username.checked, this.checks.password.checked, () => {
            this.network.send('login', { username: username, password: password })
        })
    }

    onCreateClick() {
        window.location.href = '/create'
    }

    onBackClick() {
        this.network.disconnect()
        this.scene.start('Start')
    }

    /* END-USER-CODE */
}

/* END OF COMPILED CODE */
