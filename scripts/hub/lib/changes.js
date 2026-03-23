'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { SERVICES, GLOBAL_TRIGGERS } = require('./services');
const { getServiceLastRestart } = require('./state');

function run(cmd, projectRoot) {
    try {
        return execSync(cmd, {
            cwd: projectRoot,
            encoding: 'utf8',
            timeout: 10000,
            maxBuffer: 10 * 1024 * 1024,
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
    } catch {
        return '';
    }
}

function parseFileList(output) {
    if (!output) return [];
    return output.split('\n').filter(Boolean);
}

// Run git diff scoped to specific paths to keep output small
function diffForPaths(baseSha, paths, projectRoot) {
    if (!baseSha || paths.length === 0) return [];
    const pathArgs = paths.map((p) => `'${p}'`).join(' ');
    return parseFileList(run(`git diff --name-only ${baseSha} HEAD -- ${pathArgs}`, projectRoot));
}

function workingTreeForPaths(paths, projectRoot) {
    if (paths.length === 0) return { unstaged: [], staged: [], untracked: [] };
    const pathArgs = paths.map((p) => `'${p}'`).join(' ');
    return {
        unstaged: parseFileList(run(`git diff --name-only -- ${pathArgs}`, projectRoot)),
        staged: parseFileList(run(`git diff --cached --name-only -- ${pathArgs}`, projectRoot)),
        untracked: parseFileList(run(`git ls-files --others --exclude-standard -- ${pathArgs}`, projectRoot)),
    };
}

function detectAll(projectRoot, state) {
    const results = {};
    for (const svc of SERVICES) {
        results[svc.id] = { count: 0, files: [] };
    }

    const currentHead = run('git rev-parse HEAD', projectRoot);
    if (!currentHead) return results;

    // Check global triggers (docker-compose.yml, .env) once — these affect all services
    let globalChanged = [];
    // Find the oldest SHA across all services for global diff
    let oldestSha = null;
    for (const svc of SERVICES) {
        const last = getServiceLastRestart(state, svc.id);
        if (!last.commitSha) continue;
        if (last.commitSha === currentHead) continue;
        if (!oldestSha) {
            oldestSha = last.commitSha;
        }
        // We want the oldest SHA for the broadest diff
    }

    if (oldestSha) {
        const valid = run(`git cat-file -t ${oldestSha}`, projectRoot);
        if (valid === 'commit') {
            globalChanged = diffForPaths(oldestSha, GLOBAL_TRIGGERS, projectRoot);
        }
    }
    const globalWorking = workingTreeForPaths(GLOBAL_TRIGGERS, projectRoot);
    const allGlobalChanged = [...new Set([
        ...globalChanged,
        ...globalWorking.unstaged,
        ...globalWorking.staged,
        ...globalWorking.untracked,
    ])];

    // Per-service: diff only that service's paths
    for (const svc of SERVICES) {
        const last = getServiceLastRestart(state, svc.id);
        const svcSha = last.commitSha;
        const files = new Set();

        // Committed changes since this service's last restart
        if (svcSha && svcSha !== currentHead) {
            const valid = run(`git cat-file -t ${svcSha}`, projectRoot);
            const base = valid === 'commit' ? svcSha : 'HEAD~50';
            const committed = diffForPaths(base, svc.paths, projectRoot);
            committed.forEach((f) => files.add(f));
        } else if (!svcSha) {
            // Never tracked — diff last 100 commits for this service's paths
            const committed = diffForPaths('HEAD~100', svc.paths, projectRoot);
            committed.forEach((f) => files.add(f));
        }

        // Working tree changes for this service's paths
        const working = workingTreeForPaths(svc.paths, projectRoot);
        working.unstaged.forEach((f) => files.add(f));
        working.staged.forEach((f) => files.add(f));

        // Untracked files — filter by mtime
        const lastTime = last.time ? new Date(last.time).getTime() : 0;
        for (const f of working.untracked) {
            try {
                const fullPath = path.join(projectRoot, f);
                const stat = fs.statSync(fullPath);
                if (stat.mtimeMs > lastTime) files.add(f);
            } catch {
                // skip
            }
        }

        // Add global triggers if they changed since THIS service's restart
        if (svcSha !== currentHead || !svcSha) {
            for (const f of allGlobalChanged) {
                files.add(f);
            }
        }

        results[svc.id].files = [...files];
        results[svc.id].count = files.size;
    }

    return results;
}

module.exports = { detectAll };
