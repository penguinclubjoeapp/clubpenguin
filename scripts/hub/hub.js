'use strict';

const path = require('path');
const { SERVICES } = require('./lib/services');
const { detectEnvironment } = require('./lib/environment');
const { checkAll } = require('./lib/health');
const { detectAll } = require('./lib/changes');
const { execute, executeQueue, isRunning } = require('./lib/actions');
const { load } = require('./lib/state');
const { createScreen, render } = require('./lib/ui');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// Parse CLI args
const args = process.argv.slice(2);
let forceEnv = null;
if (args.includes('--dev')) forceEnv = 'dev';
if (args.includes('--prod')) forceEnv = 'prod';

// Initialize — detect env first so state can probe real container start times
const { detectEnvironment: detectEnvForInit } = require('./lib/environment');
const initEnv = forceEnv || detectEnvForInit(PROJECT_ROOT);
const state = load(PROJECT_ROOT, initEnv);
const ui = createScreen();
let env = initEnv;
let healthResults = {};
let changeResults = {};
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
    env = forceEnv || detectEnvironment(PROJECT_ROOT);
    healthResults = checkAll(env, PROJECT_ROOT);
    changeResults = detectAll(PROJECT_ROOT, state);
    doRender();
}

function doRender() {
    render(ui, env, healthResults, changeResults, state, lastActionStatus);
}

// Navigation — bound to screen so it works regardless of focus
ui.screen.key(['j', 'down'], () => {
    const max = SERVICES.length - 1;
    const cur = ui.serviceList.selected || 0;
    if (cur < max) {
        ui.serviceList.select(cur + 1);
        ui.serviceList.focus();
    }
    process.nextTick(doRender);
});

ui.screen.key(['k', 'up'], () => {
    const cur = ui.serviceList.selected || 0;
    if (cur > 0) {
        ui.serviceList.select(cur - 1);
        ui.serviceList.focus();
    }
    process.nextTick(doRender);
});

ui.screen.key(['r'], () => {
    if (isRunning()) {
        setActionStatus({ type: 'error', message: 'Another action is already running' });
        return;
    }

    const selected = ui.serviceList.selected || 0;
    const svc = SERVICES[selected];
    if (!svc) return;

    execute(svc.id, env, PROJECT_ROOT, state, (status) => {
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
    const { getActionForService } = require('./lib/actions');
    const pending = SERVICES
        .filter((svc) => {
            const c = changeResults[svc.id];
            if (!c || c.count === 0) return false;
            const action = getActionForService(svc.id, env);
            return action && action.type !== 'auto';
        })
        .map((svc) => svc.id);

    if (pending.length === 0) {
        setActionStatus({ type: 'info', message: 'All services up to date (or auto-restart only)' });
        return;
    }

    const names = pending.map((id) => SERVICES.find((s) => s.id === id).label).join(', ');
    setActionStatus({ type: 'progress', message: `Rebuilding ${pending.length} services: ${names}` });

    executeQueue(pending, env, PROJECT_ROOT, state, (status) => {
        setActionStatus(status);
        if (status.type === 'success' || status.type === 'error') {
            setTimeout(poll, 2000);
        }
    });
});

ui.screen.key(['tab'], () => {
    poll();
    setActionStatus({ type: 'info', message: 'Refreshed' });
});

// Initial poll and start interval
poll();

setInterval(poll, 5000);
