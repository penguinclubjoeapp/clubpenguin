'use strict';

const { execSync } = require('child_process');

let ghAvailable = null;

function isGhAvailable() {
    if (ghAvailable !== null) return ghAvailable;
    try {
        execSync('gh --version', { stdio: ['pipe', 'pipe', 'pipe'], timeout: 3000 });
        ghAvailable = true;
    } catch {
        ghAvailable = false;
    }
    return ghAvailable;
}

function timeAgo(isoString) {
    if (!isoString) return '';
    const diff = Date.now() - new Date(isoString).getTime();
    if (diff < 0) return '';
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function fetchOpenPRs(githubConfig) {
    if (!githubConfig || !githubConfig.repo) return [];
    if (!isGhAvailable()) return [];

    try {
        const raw = execSync(
            `gh pr list --repo ${githubConfig.repo} --state open --json number,title,author,updatedAt,headRefName --limit 10`,
            { encoding: 'utf8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] }
        ).trim();

        if (!raw) return [];
        const prs = JSON.parse(raw);
        return prs.map((pr) => ({
            number: pr.number,
            title: pr.title,
            author: (pr.author && pr.author.login) || 'unknown',
            branch: pr.headRefName,
            updatedAt: timeAgo(pr.updatedAt),
        }));
    } catch {
        return [];
    }
}

module.exports = { fetchOpenPRs };
