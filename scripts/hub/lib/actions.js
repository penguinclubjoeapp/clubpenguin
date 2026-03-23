'use strict';

const { spawn } = require('child_process');
const { SERVICES } = require('./services');
const { markRestarted } = require('./state');

let activeAction = null;

function isRunning() {
    return activeAction !== null;
}

function getActionForService(serviceId, env) {
    const svc = SERVICES.find((s) => s.id === serviceId);
    if (!svc) return null;

    // mixed/none fall back to prod actions
    const action = svc.actions[env] || svc.actions['prod'];
    if (!action) return null;

    return action;
}

function execute(serviceId, env, projectRoot, state, onUpdate) {
    if (activeAction) {
        onUpdate({ type: 'error', message: 'Another action is already running' });
        return;
    }

    const action = getActionForService(serviceId, env);
    if (!action) {
        onUpdate({ type: 'error', message: `No action available for ${serviceId} in ${env} mode` });
        return;
    }

    if (action.type === 'auto') {
        onUpdate({ type: 'info', message: action.message });
        return;
    }

    const svc = SERVICES.find((s) => s.id === serviceId);
    const label = svc ? svc.label : serviceId;
    const verb = action.type === 'rebuild' ? 'Rebuilding' : 'Restarting';

    activeAction = serviceId;
    onUpdate({ type: 'progress', message: `${verb} ${label}...`, serviceId });

    const child = spawn('bash', ['-c', action.cmd], {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
        stdout += data.toString();
    });
    child.stderr.on('data', (data) => {
        stderr += data.toString();
    });

    child.on('close', (code) => {
        activeAction = null;
        const now = new Date().toLocaleTimeString();

        if (code === 0) {
            markRestarted(projectRoot, state, serviceId);
            const pastVerb = action.type === 'rebuild' ? 'Rebuilt' : 'Restarted';
            onUpdate({ type: 'success', message: `${pastVerb} ${label} (${now})`, serviceId });
        } else {
            const errLine = stderr.split('\n').filter(Boolean).pop() || `Exit code ${code}`;
            onUpdate({ type: 'error', message: `Failed: ${label} — ${errLine}`, serviceId });
        }
    });

    child.on('error', (err) => {
        activeAction = null;
        onUpdate({ type: 'error', message: `Failed to start: ${err.message}`, serviceId });
    });
}

function executeQueue(serviceIds, env, projectRoot, state, onUpdate) {
    if (activeAction) {
        onUpdate({ type: 'error', message: 'Another action is already running' });
        return;
    }

    // Filter to services that have a real (non-auto) action
    const queue = serviceIds.filter((id) => {
        const action = getActionForService(id, env);
        return action && action.type !== 'auto';
    });

    if (queue.length === 0) {
        onUpdate({ type: 'info', message: 'Nothing to rebuild' });
        return;
    }

    let completed = 0;
    const total = queue.length;

    function next() {
        if (completed >= total) {
            onUpdate({ type: 'success', message: `Rebuilt all ${total} services (${new Date().toLocaleTimeString()})` });
            return;
        }

        const id = queue[completed];
        execute(id, env, projectRoot, state, (status) => {
            if (status.type === 'progress') {
                onUpdate({ type: 'progress', message: `[${completed + 1}/${total}] ${status.message}`, serviceId: status.serviceId });
            } else if (status.type === 'success') {
                completed++;
                onUpdate({ type: 'progress', message: `[${completed}/${total}] ${status.message}`, serviceId: status.serviceId });
                next();
            } else {
                // Error — stop the queue
                onUpdate(status);
            }
        });
    }

    next();
}

module.exports = { execute, executeQueue, isRunning, getActionForService };
