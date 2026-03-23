'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function run(cmd, cwd) {
    try {
        return execSync(cmd, { cwd, encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch {
        return '';
    }
}

function scanForServices(projectRoot) {
    const services = [];

    // Look for docker-compose.yml services
    const composePath = path.join(projectRoot, 'docker-compose.yml');
    if (fs.existsSync(composePath)) {
        const raw = run('docker compose config --services', projectRoot);
        if (raw) {
            for (const name of raw.split('\n').filter(Boolean)) {
                services.push({
                    id: name,
                    label: name.charAt(0).toUpperCase() + name.slice(1).replace(/[-_]/g, ' '),
                    prod: { type: 'docker', service: name },
                    dev: { type: 'none' },
                    paths: [],
                    actions: {
                        prod: { type: 'rebuild', cmd: `docker compose up -d --build ${name}` },
                        dev: null,
                    },
                });
            }
        }
    }

    // If no docker services found, look for directories with Dockerfiles or package.json
    if (services.length === 0) {
        const entries = fs.readdirSync(projectRoot, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            const dir = path.join(projectRoot, entry.name);
            const hasDockerfile = fs.existsSync(path.join(dir, 'Dockerfile'));
            const hasPackageJson = fs.existsSync(path.join(dir, 'package.json'));
            if (hasDockerfile || hasPackageJson) {
                services.push({
                    id: entry.name,
                    label: entry.name.charAt(0).toUpperCase() + entry.name.slice(1).replace(/[-_]/g, ' '),
                    prod: hasDockerfile ? { type: 'docker', service: entry.name } : { type: 'none' },
                    dev: { type: 'none' },
                    paths: [`${entry.name}/`],
                    actions: {
                        prod: hasDockerfile
                            ? { type: 'rebuild', cmd: `docker compose up -d --build ${entry.name}` }
                            : null,
                        dev: null,
                    },
                });
            }
        }
    }

    return services;
}

function detectGithubRepo(projectRoot) {
    const remote = run('git remote get-url origin', projectRoot);
    if (!remote) return null;

    // Parse github.com:owner/repo.git or https://github.com/owner/repo.git
    const sshMatch = remote.match(/github\.com[:/](.+?)(?:\.git)?$/);
    if (sshMatch) return sshMatch[1];
    return null;
}

function generateConfig(projectRoot) {
    const dirName = path.basename(projectRoot);
    const projectName = dirName.charAt(0).toUpperCase() + dirName.slice(1).replace(/[-_]/g, ' ');
    const services = scanForServices(projectRoot);
    const githubRepo = detectGithubRepo(projectRoot);

    const githubBlock = githubRepo
        ? `\n    github: {\n        repo: '${githubRepo}',\n        remote: 'origin',\n        defaultBranch: 'main',\n    },\n`
        : '';

    const servicesStr = services.map((svc) => {
        const lines = [];
        lines.push('        {');
        lines.push(`            id: '${svc.id}',`);
        lines.push(`            label: '${svc.label}',`);
        lines.push(`            prod: ${JSON.stringify(svc.prod)},`);
        lines.push(`            dev: ${JSON.stringify(svc.dev)},`);
        lines.push(`            paths: [${svc.paths.map((p) => `'${p}'`).join(', ')}],`);
        lines.push('            actions: {');
        if (svc.actions.prod) {
            lines.push(`                prod: { type: '${svc.actions.prod.type}', cmd: '${svc.actions.prod.cmd}' },`);
        } else {
            lines.push('                prod: null,');
        }
        lines.push('                dev: null,');
        lines.push('            },');
        lines.push('        },');
        return lines.join('\n');
    }).join('\n');

    return `'use strict';

const path = require('path');

module.exports = {
    name: '${projectName}',
    root: path.resolve(__dirname),
${githubBlock}
    services: [
${servicesStr}
    ],

    globalTriggers: ['docker-compose.yml', '.env'],

    polling: {
        health: 5000,
        github: 60000,
    },

    stateFile: '.hub-state.json',
};
`;
}

function init(targetDir) {
    const projectRoot = path.resolve(targetDir || process.cwd());
    const configPath = path.join(projectRoot, 'hub.config.js');

    if (fs.existsSync(configPath)) {
        console.error(`hub.config.js already exists at ${configPath}`);
        process.exit(1);
    }

    const config = generateConfig(projectRoot);
    fs.writeFileSync(configPath, config);

    console.log(`Created ${configPath}`);
    console.log('');
    console.log('Edit the config to customize services, paths, and actions.');
    console.log('Then run: devhub');
}

module.exports = { init };
