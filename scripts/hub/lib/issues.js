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

function fetchOpenIssues(githubConfig) {
    if (!githubConfig || !githubConfig.repo) return [];
    if (!isGhAvailable()) return [];

    try {
        const raw = execSync(
            `gh issue list --repo ${githubConfig.repo} --state open --json number,title,author,updatedAt,labels --limit 20`,
            { encoding: 'utf8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] }
        ).trim();

        if (!raw) return [];
        const issues = JSON.parse(raw);
        return issues.map((issue) => ({
            number: issue.number,
            title: issue.title,
            author: (issue.author && issue.author.login) || 'unknown',
            updatedAt: timeAgo(issue.updatedAt),
            labels: (issue.labels || []).map((l) => l.name),
        }));
    } catch {
        return [];
    }
}

module.exports = { fetchOpenIssues };
