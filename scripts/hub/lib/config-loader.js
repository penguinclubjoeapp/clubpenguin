'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULTS = {
    globalTriggers: [],
    polling: { health: 5000, github: 60000 },
    stateFile: '.hub-state.json',
};

function findConfig(cliArgs) {
    // 1. Explicit --config path
    const idx = cliArgs.indexOf('--config');
    if (idx !== -1 && cliArgs[idx + 1]) {
        const p = path.resolve(cliArgs[idx + 1]);
        if (fs.existsSync(p)) return p;
        throw new Error(`Config not found: ${p}`);
    }

    // 2. Adjacent to hub.js
    const adjacent = path.resolve(__dirname, '..', 'hub.config.js');
    if (fs.existsSync(adjacent)) return adjacent;

    // 3. Walk up from cwd
    let dir = process.cwd();
    while (true) {
        const candidate = path.join(dir, 'hub.config.js');
        if (fs.existsSync(candidate)) return candidate;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }

    throw new Error('No hub.config.js found. Create one or use --config <path>');
}

function validate(config) {
    if (!config.name) throw new Error('hub.config.js: "name" is required');
    if (!config.root) throw new Error('hub.config.js: "root" is required');
    if (!Array.isArray(config.services) || config.services.length === 0) {
        throw new Error('hub.config.js: "services" must be a non-empty array');
    }

    for (const svc of config.services) {
        if (!svc.id) throw new Error('hub.config.js: each service needs an "id"');
        if (!svc.label) throw new Error(`hub.config.js: service "${svc.id}" needs a "label"`);
        if (!Array.isArray(svc.paths)) throw new Error(`hub.config.js: service "${svc.id}" needs a "paths" array`);
    }
}

function loadConfig(cliArgs) {
    const configPath = findConfig(cliArgs || []);
    const config = require(configPath);

    // Apply defaults
    config.globalTriggers = config.globalTriggers || DEFAULTS.globalTriggers;
    config.polling = Object.assign({}, DEFAULTS.polling, config.polling || {});
    config.stateFile = config.stateFile || DEFAULTS.stateFile;

    validate(config);

    return config;
}

module.exports = { loadConfig };
