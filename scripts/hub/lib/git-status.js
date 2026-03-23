'use strict';

const { execSync } = require('child_process');

function run(cmd, projectRoot) {
    try {
        return execSync(cmd, {
            cwd: projectRoot,
            encoding: 'utf8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
    } catch {
        return '';
    }
}

function countLines(output) {
    if (!output) return 0;
    return output.split('\n').filter(Boolean).length;
}

function fetchGitStatus(projectRoot) {
    const branch = run('git branch --show-current', projectRoot) || '(detached)';

    let upstream = null;
    let ahead = 0;
    let behind = 0;
    const upstreamRaw = run('git rev-parse --abbrev-ref @{upstream}', projectRoot);
    if (upstreamRaw) {
        upstream = upstreamRaw;
        ahead = parseInt(run('git rev-list --count @{upstream}..HEAD', projectRoot), 10) || 0;
        behind = parseInt(run('git rev-list --count HEAD..@{upstream}', projectRoot), 10) || 0;
    }

    const staged = countLines(run('git diff --cached --name-only', projectRoot));
    const unstaged = countLines(run('git diff --name-only', projectRoot));
    const untracked = countLines(run('git ls-files --others --exclude-standard', projectRoot));
    const stashCount = countLines(run('git stash list', projectRoot));

    // Recent commits
    const logRaw = run('git log --oneline -5 --format="%h|%s|%an|%cr"', projectRoot);
    const recentCommits = logRaw ? logRaw.split('\n').filter(Boolean).map((line) => {
        const parts = line.split('|');
        return {
            sha: parts[0] || '',
            subject: parts[1] || '',
            author: parts[2] || '',
            timeAgo: parts[3] || '',
        };
    }) : [];

    return { branch, upstream, ahead, behind, staged, unstaged, untracked, stashCount, recentCommits };
}

module.exports = { fetchGitStatus };
