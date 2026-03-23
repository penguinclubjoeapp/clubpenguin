'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getContainerStartTime, getProcessStartTime } = require('./environment');

const STATE_FILE = '.hub-state.json';

function getStatePath(projectRoot) {
    return path.join(projectRoot, STATE_FILE);
}

function getCurrentSha(projectRoot) {
    try {
        return execSync('git rev-parse HEAD', {
            cwd: projectRoot,
            encoding: 'utf8',
            timeout: 3000,
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
    } catch {
        return null;
    }
}

function getShaAtTime(projectRoot, isoTime) {
    try {
        return execSync(`git log --before="${isoTime}" -1 --format=%H`, {
            cwd: projectRoot,
            encoding: 'utf8',
            timeout: 3000,
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim() || null;
    } catch {
        return null;
    }
}

function probeServiceStartTime(svc, env, projectRoot) {
    const def = svc[env] || svc.prod;
    if (!def) return null;

    if (def.type === 'docker') {
        // Docker compose names containers as {project}-{service}-{n}
        // Project name defaults to the directory name
        const dirName = path.basename(projectRoot).toLowerCase().replace(/[^a-z0-9]/g, '');
        const names = [
            def.service,
            `${dirName}-${def.service}-1`,
            `${dirName}-${def.service}`,
        ];
        for (const name of names) {
            const t = getContainerStartTime(name);
            if (t) return t;
        }
    } else if (def.type === 'process') {
        return getProcessStartTime(def.pattern);
    }

    return null;
}

function load(projectRoot, services, env) {
    const filePath = getStatePath(projectRoot);
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
    } catch {
        // First run — seed from actual service start times
        const state = { lastRestart: {} };

        for (const svc of services) {
            const startTime = probeServiceStartTime(svc, env || 'prod', projectRoot);
            if (startTime) {
                const sha = getShaAtTime(projectRoot, startTime) || getCurrentSha(projectRoot);
                state.lastRestart[svc.id] = { time: startTime, commitSha: sha };
            }
            // If no start time found, leave empty — getServiceLastRestart handles this
        }

        save(projectRoot, state);
        return state;
    }
}

function save(projectRoot, state) {
    const filePath = getStatePath(projectRoot);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2) + '\n');
}

function markRestarted(projectRoot, state, serviceId) {
    const sha = getCurrentSha(projectRoot);
    const now = new Date().toISOString();
    state.lastRestart[serviceId] = { time: now, commitSha: sha };
    save(projectRoot, state);
}

function getServiceLastRestart(state, serviceId) {
    if (state.lastRestart[serviceId]) {
        return state.lastRestart[serviceId];
    }
    // No data — service has never been restarted while hub is tracking
    return { time: null, commitSha: null };
}

module.exports = { load, save, markRestarted, getServiceLastRestart, getCurrentSha };
