'use strict';

function mapFileToServices(services, globalTriggers, filePath) {
    for (const trigger of globalTriggers) {
        if (filePath === trigger || filePath.startsWith(trigger + '/')) {
            return services.map((s) => s.id);
        }
    }

    const matched = [];
    for (const svc of services) {
        for (const prefix of svc.paths) {
            if (filePath === prefix || filePath.startsWith(prefix)) {
                matched.push(svc.id);
                break;
            }
        }
    }

    return matched;
}

module.exports = { mapFileToServices };
