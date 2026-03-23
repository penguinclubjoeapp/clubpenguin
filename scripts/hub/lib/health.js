'use strict';

const { getDockerServiceStatus, getProcessStatus } = require('./environment');

function checkAll(services, env, projectRoot) {
    const results = {};

    for (const svc of services) {
        const def = svc[env] || svc.prod;

        if (!def || def.type === 'none') {
            results[svc.id] = { status: 'n/a', health: null };
            continue;
        }

        if (def.type === 'docker') {
            results[svc.id] = getDockerServiceStatus(
                def.service,
                def.composeFile || null,
                projectRoot
            );
        } else if (def.type === 'process') {
            results[svc.id] = getProcessStatus(def.pattern);
        } else {
            results[svc.id] = { status: 'unknown', health: null };
        }
    }

    return results;
}

module.exports = { checkAll };
