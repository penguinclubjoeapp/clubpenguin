'use strict';

const blessed = require('neo-blessed');

const STATUS_COLORS = {
    running: 'green',
    healthy: 'green',
    stopped: 'red',
    unhealthy: 'yellow',
    starting: 'cyan',
    'n/a': 'white',
    unknown: 'white',
};

const ENV_STYLES = {
    prod: '{green-bg}{black-fg} PROD {/}',
    dev: '{cyan-bg}{black-fg} DEV {/}',
    mixed: '{yellow-bg}{black-fg} MIXED {/}',
    none: '{red-bg}{white-fg} NONE {/}',
};

function timeAgo(isoString) {
    if (!isoString) return 'unknown';
    const diff = Date.now() - new Date(isoString).getTime();
    if (diff < 0) return 'unknown';
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function createScreen(config) {
    const numServices = config.services.length;

    const screen = blessed.screen({
        smartCSR: true,
        title: `${config.name} Hub`,
        fullUnicode: true,
    });

    let y = 0;

    // Header
    const header = blessed.box({
        parent: screen,
        top: y,
        left: 0,
        width: '100%',
        height: 1,
        tags: true,
        style: { fg: 'white', bg: 'black' },
    });
    y += 1;

    // Column headers
    const colHeader = blessed.box({
        parent: screen,
        top: y,
        left: 0,
        width: '100%',
        height: 1,
        tags: true,
        style: { fg: 'white', bg: 'blue' },
    });
    y += 1;

    // Service list
    const serviceList = blessed.list({
        parent: screen,
        top: y,
        left: 0,
        width: '100%',
        height: numServices,
        tags: true,
        mouse: true,
        style: {
            selected: { bg: 'blue', fg: 'white' },
            item: { fg: 'white' },
        },
    });
    y += numServices;

    // Separator
    const sep = blessed.line({
        parent: screen,
        top: y,
        left: 0,
        width: '100%',
        orientation: 'horizontal',
        style: { fg: 'gray' },
    });
    y += 1;

    // Detail panel (changed files)
    const detailPanel = blessed.box({
        parent: screen,
        top: y,
        left: 0,
        width: '100%',
        height: 6,
        tags: true,
        scrollable: true,
        alwaysScroll: true,
        keys: true,
        vi: true,
        style: { fg: 'white' },
        padding: { left: 1 },
    });
    y += 6;

    // Rebuild All button
    const rebuildAllBtn = blessed.box({
        parent: screen,
        top: y + 1,
        left: 1,
        width: 30,
        height: 3,
        tags: true,
        align: 'center',
        valign: 'middle',
        border: { type: 'line' },
        style: {
            fg: 'gray',
            border: { fg: 'gray' },
        },
    });
    y += 4;

    // Git separator
    const gitSep = blessed.line({
        parent: screen,
        top: y,
        left: 0,
        width: '100%',
        orientation: 'horizontal',
        style: { fg: 'gray' },
    });
    y += 1;

    // Git panel — fills remaining space above footer
    const gitPanel = blessed.box({
        parent: screen,
        top: y,
        left: 0,
        width: '100%',
        bottom: 2,
        tags: true,
        scrollable: true,
        alwaysScroll: true,
        keys: true,
        vi: true,
        style: { fg: 'white' },
        padding: { left: 1 },
    });

    // Footer (keybindings)
    const footer = blessed.box({
        parent: screen,
        bottom: 1,
        left: 0,
        width: '100%',
        height: 1,
        tags: true,
        style: { fg: 'white', bg: 'black' },
        padding: { left: 1 },
    });
    footer.setContent('{bold}[R]{/} Rebuild   {bold}[Enter]{/} Rebuild All   {bold}[j/k]{/} Navigate   {bold}[g]{/} Git   {bold}[Tab]{/} Refresh   {bold}[Q]{/} Quit');

    // Status line
    const statusLine = blessed.box({
        parent: screen,
        bottom: 0,
        left: 0,
        width: '100%',
        height: 1,
        tags: true,
        style: { fg: 'white', bg: 'black' },
        padding: { left: 1 },
    });

    screen.key(['q', 'C-c'], () => {
        screen.destroy();
        process.exit(0);
    });

    // Focus the service list so it receives key events
    serviceList.focus();

    return { screen, header, colHeader, serviceList, detailPanel, rebuildAllBtn, gitPanel, statusLine };
}

function formatRow(label, status, health, changeCount, lastRestart, actionLabel, width) {
    const statusDisplay = health === 'healthy' ? 'healthy' : (health && health !== 'none' ? health : status);
    const statusColor = STATUS_COLORS[statusDisplay] || STATUS_COLORS[status] || 'white';

    const col1 = label.padEnd(16);
    const col2 = `{${statusColor}-fg}${statusDisplay.padEnd(12)}{/}`;
    const col3 = changeCount > 0
        ? `{yellow-fg}${(changeCount + (changeCount === 1 ? ' file' : ' files')).padEnd(10)}{/}`
        : '{white-fg}' + '-'.padEnd(10) + '{/}';
    const col4 = (lastRestart || 'never').padEnd(13);
    const col5 = actionLabel
        ? `{bold}${actionLabel}{/}`
        : '';

    return `  ${col1}${col2}${col3}${col4}${col5}`;
}

function render(ui, config, env, healthResults, changeResults, state, actionStatus, gitStatus, prList, getActionForService) {
    const { header, colHeader, serviceList, detailPanel, statusLine, gitPanel } = ui;
    const services = config.services;

    // Header
    const now = new Date().toLocaleTimeString();
    const envBadge = ENV_STYLES[env] || ENV_STYLES.none;
    header.setContent(` {bold}${config.name.toUpperCase()} HUB{/}    ${envBadge}    ${now}`);

    // Column headers
    const ch1 = 'Service'.padEnd(16);
    const ch2 = 'Status'.padEnd(12);
    const ch3 = 'Changes'.padEnd(10);
    const ch4 = 'Restarted'.padEnd(13);
    const ch5 = 'Action';
    colHeader.setContent(`  ${ch1}${ch2}${ch3}${ch4}${ch5}`);

    // Service rows
    const selected = serviceList.selected || 0;
    const items = services.map((svc) => {
        const h = healthResults[svc.id] || { status: 'unknown', health: null };
        const c = changeResults[svc.id] || { count: 0, files: [] };
        const lastInfo = state.lastRestart[svc.id];
        const lastStr = lastInfo ? timeAgo(lastInfo.time) : 'unknown';

        let actionLabel = '';
        if (c.count > 0) {
            const action = getActionForService(services, svc.id, env);
            if (action) {
                if (action.type === 'auto') actionLabel = 'auto';
                else if (action.type === 'rebuild') actionLabel = 'rebuild';
                else if (action.type === 'restart') actionLabel = 'restart';
            }
        }

        // Show "REBUILDING..." if this service has an active action
        if (actionStatus && actionStatus.serviceId === svc.id && actionStatus.type === 'progress') {
            actionLabel = `{yellow-fg}${actionStatus.message}{/}`;
        }

        return formatRow(svc.label, h.status, h.health, c.count, lastStr, actionLabel, ui.screen.width);
    });

    serviceList.setItems(items);
    serviceList.select(selected);

    // Detail panel — show changed files for selected service
    const selectedSvc = services[selected];
    if (selectedSvc) {
        const c = changeResults[selectedSvc.id] || { count: 0, files: [] };
        if (c.files.length > 0) {
            detailPanel.setContent(
                `{bold}Changed files for ${selectedSvc.label}:{/}\n` +
                c.files.map((f) => `  ${f}`).join('\n')
            );
        } else {
            detailPanel.setContent(`{white-fg}No pending changes for ${selectedSvc.label}{/}`);
        }
    }

    // Rebuild All button
    const { rebuildAllBtn } = ui;
    const pendingCount = services.filter((s) => {
        const c = changeResults[s.id] || { count: 0 };
        if (c.count === 0) return false;
        const action = getActionForService(services, s.id, env);
        return action && action.type !== 'auto';
    }).length;

    if (actionStatus && actionStatus.type === 'progress') {
        rebuildAllBtn.setContent('{yellow-fg}{bold}Rebuilding...{/}');
        rebuildAllBtn.style.border.fg = 'yellow';
        rebuildAllBtn.style.fg = 'yellow';
    } else if (pendingCount > 0) {
        rebuildAllBtn.setContent(`{green-fg}{bold}Rebuild All Pending (${pendingCount}){/}`);
        rebuildAllBtn.style.border.fg = 'green';
        rebuildAllBtn.style.fg = 'green';
    } else {
        rebuildAllBtn.setContent('{white-fg}All Up to Date{/}');
        rebuildAllBtn.style.border.fg = 'white';
        rebuildAllBtn.style.fg = 'white';
    }

    // Git status panel
    if (gitStatus) {
        const lines = [];

        // Branch line
        let branchLine = `{bold}Branch:{/} {white-fg}${gitStatus.branch}{/}`;
        if (gitStatus.upstream) {
            const aheadStr = gitStatus.ahead > 0 ? `{green-fg}+${gitStatus.ahead}{/}` : '{white-fg}+0{/}';
            const behindStr = gitStatus.behind > 0 ? `{red-fg}-${gitStatus.behind}{/}` : '{white-fg}-0{/}';
            branchLine += `  {white-fg}[${gitStatus.upstream}:{/} ${aheadStr}/{behindStr}{white-fg}]{/}`;
        } else {
            branchLine += '  {white-fg}(no upstream){/}';
        }
        lines.push(branchLine);

        // Changes summary
        const parts = [];
        if (gitStatus.staged > 0) parts.push(`{green-fg}${gitStatus.staged} staged{/}`);
        if (gitStatus.unstaged > 0) parts.push(`{yellow-fg}${gitStatus.unstaged} modified{/}`);
        if (gitStatus.untracked > 0) parts.push(`{red-fg}${gitStatus.untracked} untracked{/}`);
        lines.push(`{bold}Changes:{/} ${parts.length > 0 ? parts.join('  ') : '{white-fg}clean{/}'}`);

        // Stash
        if (gitStatus.stashCount > 0) {
            lines.push(`{bold}Stash:{/}   {magenta-fg}${gitStatus.stashCount} stash(es){/}`);
        }

        // Recent commits
        if (gitStatus.recentCommits.length > 0) {
            lines.push('');
            lines.push('{bold}Recent Commits:{/}');
            for (const c of gitStatus.recentCommits) {
                lines.push(`  {cyan-fg}${c.sha}{/} ${c.subject} {gray-fg}(${c.author}, ${c.timeAgo}){/}`);
            }
        }

        // Open PRs
        if (prList !== null && prList !== undefined) {
            lines.push('');
            if (prList.length > 0) {
                lines.push(`{bold}Open PRs ({white-fg}${prList.length}{/}{bold}):{/}`);
                for (const pr of prList) {
                    lines.push(`  {green-fg}#${pr.number}{/} ${pr.title} {gray-fg}[${pr.branch}] (${pr.author}, ${pr.updatedAt}){/}`);
                }
            } else {
                lines.push('{bold}Open PRs:{/} {white-fg}none{/}');
            }
        }

        gitPanel.setContent(lines.join('\n'));
    }

    // Status line
    if (actionStatus && actionStatus.type !== 'progress') {
        const color = actionStatus.type === 'success' ? 'green' : actionStatus.type === 'error' ? 'red' : 'yellow';
        statusLine.setContent(`{${color}-fg}${actionStatus.message}{/}`);
    }

    ui.screen.render();
}

module.exports = { createScreen, render };
