'use strict';

const { execSync } = require('child_process');

function run(cmd) {
    try {
        return execSync(cmd, { encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch {
        return '';
    }
}

function detectEnvironment(projectRoot) {
    const opts = { cwd: projectRoot };

    // Check production containers
    const prodPs = run(`docker compose -f docker-compose.yml ps --format "{{.Name}} {{.State}}"`, opts);
    const prodRunning = prodPs.length > 0 && prodPs.includes('running');

    // Check dev containers
    const devPs = run(`docker compose -f docker-compose.dev.yml ps --format "{{.Name}} {{.State}}"`, opts);
    const devMysqlRunning = devPs.length > 0 && devPs.includes('running');

    // Check dev host processes
    const devServerRunning = run('pgrep -f babel-watch').length > 0;
    const devClientRunning = run('pgrep -f "webpack.*serve"').length > 0;

    const devActive = devMysqlRunning || devServerRunning || devClientRunning;

    if (prodRunning && devActive) return 'mixed';
    if (prodRunning) return 'prod';
    if (devActive) return 'dev';
    return 'none';
}

function getDockerServiceStatus(service, composeFile, projectRoot) {
    const flag = composeFile ? `-f ${composeFile}` : '';
    const raw = run(`docker compose ${flag} ps --format json ${service}`);
    if (!raw) return { status: 'stopped', health: null };

    try {
        // docker compose ps --format json may return one JSON object per line
        const lines = raw.split('\n').filter(Boolean);
        for (const line of lines) {
            const obj = JSON.parse(line);
            const state = (obj.State || '').toLowerCase();
            const health = (obj.Health || '').toLowerCase();
            if (state === 'running') {
                return { status: 'running', health: health || 'none' };
            }
        }
        return { status: 'stopped', health: null };
    } catch {
        // Fallback: parse text output
        if (raw.toLowerCase().includes('running')) {
            return { status: 'running', health: 'unknown' };
        }
        return { status: 'stopped', health: null };
    }
}

function getProcessStatus(pattern) {
    const pid = run(`pgrep -f '${pattern}'`);
    return pid.length > 0 ? { status: 'running', health: 'none' } : { status: 'stopped', health: null };
}

function getContainerStartTime(containerName) {
    const raw = run(`docker inspect --format "{{.State.StartedAt}}" ${containerName}`);
    if (!raw || raw.includes('Error') || raw.includes('No such')) return null;
    // Docker returns ISO 8601 with nanoseconds — JS can parse it
    const date = new Date(raw);
    return isNaN(date.getTime()) ? null : date.toISOString();
}

function getProcessStartTime(pattern) {
    // Get PID, then read its start time from /proc
    const pid = run(`pgrep -f '${pattern}' | head -1`);
    if (!pid) return null;
    const etimes = run(`ps -o etimes= -p ${pid}`);
    if (!etimes) return null;
    const elapsedSeconds = parseInt(etimes.trim(), 10);
    if (isNaN(elapsedSeconds)) return null;
    return new Date(Date.now() - elapsedSeconds * 1000).toISOString();
}

module.exports = { detectEnvironment, getDockerServiceStatus, getProcessStatus, getContainerStartTime, getProcessStartTime };
