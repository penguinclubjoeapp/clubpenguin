#!/usr/bin/env node
'use strict';

const { loadConfig } = require('./lib/config-loader');
const { detectEnvironment } = require('./lib/environment');
const { checkAll } = require('./lib/health');
const { detectAll } = require('./lib/changes');
const { execute, executeQueue, isRunning, getActionForService } = require('./lib/actions');
const { load } = require('./lib/state');
const { fetchGitStatus } = require('./lib/git-status');
const { fetchOpenPRs } = require('./lib/github');
const { createScreen, render } = require('./lib/ui');

// Parse CLI args
const args = process.argv.slice(2);
let forceEnv = null;
if (args.includes('--dev')) forceEnv = 'dev';
if (args.includes('--prod')) forceEnv = 'prod';

// Load config
const config = loadConfig(args);

// Initialize
const initEnv = forceEnv || detectEnvironment(config.root);
const state = load(config.root, config.services, initEnv);
const ui = createScreen(config);
let env = initEnv;
let healthResults = {};
let changeResults = {};
let gitStatus = null;
let prList = null;
let lastActionStatus = null;
let actionStatusTimer = null;

function setActionStatus(status) {
    lastActionStatus = status;

    // Clear non-progress statuses after 10 seconds
    if (actionStatusTimer) clearTimeout(actionStatusTimer);
    if (status && status.type !== 'progress') {
        actionStatusTimer = setTimeout(() => {
            lastActionStatus = null;
            doRender();
        }, 10000);
    }

    doRender();
}

function poll() {
    env = forceEnv || detectEnvironment(config.root);
    healthResults = checkAll(config.services, env, config.root);
    changeResults = detectAll(config.root, config.services, config.globalTriggers, state);
    gitStatus = fetchGitStatus(config.root);
    doRender();
}

function pollGithub() {
    if (config.github) {
        prList = fetchOpenPRs(config.github);
        doRender();
    }
}

function doRender() {
    render(ui, config, env, healthResults, changeResults, state, lastActionStatus, gitStatus, prList, getActionForService);
}

// Navigation — bound to screen so it works regardless of focus
let gitPanelFocused = false;

ui.screen.key(['j', 'down'], () => {
    if (gitPanelFocused) {
        ui.gitPanel.scroll(1);
        process.nextTick(doRender);
        return;
    }
    const max = config.services.length - 1;
    const cur = ui.serviceList.selected || 0;
    if (cur < max) {
        ui.serviceList.select(cur + 1);
        ui.serviceList.focus();
    }
    process.nextTick(doRender);
});

ui.screen.key(['k', 'up'], () => {
    if (gitPanelFocused) {
        ui.gitPanel.scroll(-1);
        process.nextTick(doRender);
        return;
    }
    const cur = ui.serviceList.selected || 0;
    if (cur > 0) {
        ui.serviceList.select(cur - 1);
        ui.serviceList.focus();
    }
    process.nextTick(doRender);
});

ui.screen.key(['g'], () => {
    gitPanelFocused = !gitPanelFocused;
    if (gitPanelFocused) {
        ui.gitPanel.focus();
        ui.gitPanel.style.border = { fg: 'cyan' };
    } else {
        ui.serviceList.focus();
        delete ui.gitPanel.style.border;
    }
    process.nextTick(doRender);
});

ui.screen.key(['escape'], () => {
    if (gitPanelFocused) {
        gitPanelFocused = false;
        ui.serviceList.focus();
        delete ui.gitPanel.style.border;
        process.nextTick(doRender);
    }
});

ui.screen.key(['r'], () => {
    if (isRunning()) {
        setActionStatus({ type: 'error', message: 'Another action is already running' });
        return;
    }

    const selected = ui.serviceList.selected || 0;
    const svc = config.services[selected];
    if (!svc) return;

    execute(config.services, svc.id, env, config.root, state, (status) => {
        setActionStatus(status);
        // Re-poll after action completes to refresh health
        if (status.type === 'success' || status.type === 'error') {
            setTimeout(poll, 2000);
        }
    });
});

ui.screen.key(['enter'], () => {
    if (isRunning()) {
        setActionStatus({ type: 'error', message: 'Another action is already running' });
        return;
    }

    // Find services with pending changes that have a real (non-auto) action
    const pending = config.services
        .filter((svc) => {
            const c = changeResults[svc.id];
            if (!c || c.count === 0) return false;
            const action = getActionForService(config.services, svc.id, env);
            return action && action.type !== 'auto';
        })
        .map((svc) => svc.id);

    if (pending.length === 0) {
        setActionStatus({ type: 'info', message: 'All services up to date (or auto-restart only)' });
        return;
    }

    const names = pending.map((id) => config.services.find((s) => s.id === id).label).join(', ');
    setActionStatus({ type: 'progress', message: `Rebuilding ${pending.length} services: ${names}` });

    executeQueue(config.services, pending, env, config.root, state, (status) => {
        setActionStatus(status);
        if (status.type === 'success' || status.type === 'error') {
            setTimeout(poll, 2000);
        }
    });
});

ui.screen.key(['tab'], () => {
    poll();
    pollGithub();
    setActionStatus({ type: 'info', message: 'Refreshed' });
});

// Initial poll and start intervals
poll();
pollGithub();

setInterval(poll, config.polling.health);
setInterval(pollGithub, config.polling.github);
