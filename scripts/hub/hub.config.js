'use strict';

const path = require('path');

module.exports = {
    name: 'Club Penguin',
    root: path.resolve(__dirname, '..', '..'),

    github: {
        repo: 'penguinclubJoeapp/ClubPenguin',
        remote: 'origin',
        defaultBranch: 'main',
    },

    services: [
        {
            id: 'mysql',
            label: 'MySQL',
            prod: { type: 'docker', service: 'mysql' },
            dev: { type: 'docker', service: 'mysql-dev', composeFile: 'docker-compose.dev.yml' },
            paths: ['yukon-server/yukon.sql'],
            actions: {
                prod: { type: 'restart', cmd: 'docker compose restart mysql' },
                dev: { type: 'restart', cmd: 'docker compose -f docker-compose.dev.yml restart mysql-dev' },
            },
        },
        {
            id: 'yukon-server',
            label: 'Game Server',
            prod: { type: 'docker', service: 'yukon-server' },
            dev: { type: 'process', pattern: 'babel-watch' },
            paths: [
                'yukon-server/src/',
                'yukon-server/config/',
                'yukon-server/package.json',
                'yukon-server/package-lock.json',
                'yukon-server/Dockerfile',
                'yukon-server/.babelrc',
            ],
            actions: {
                prod: { type: 'rebuild', cmd: 'docker compose up -d --build yukon-server' },
                dev: { type: 'auto', message: 'babel-watch auto-restarts on file changes' },
            },
        },
        {
            id: 'yukon-client',
            label: 'HTML5 Client',
            prod: { type: 'docker', service: 'yukon-client' },
            dev: { type: 'process', pattern: 'webpack.*serve' },
            paths: [
                'yukon/src/',
                'yukon/assets/',
                'yukon/create/',
                'yukon/defs/',
                'yukon/webpack.config.js',
                'yukon/package.json',
                'yukon/package-lock.json',
                'yukon/index.ejs',
                'yukon/index.html',
                'nginx/yukon-client.conf',
            ],
            actions: {
                prod: {
                    type: 'rebuild',
                    cmd: 'cd yukon && npm run build && cd .. && docker compose up -d yukon-client',
                },
                dev: { type: 'auto', message: 'webpack-dev-server has HMR' },
            },
        },
        {
            id: 'discord-bot',
            label: 'Discord Bot',
            prod: { type: 'docker', service: 'discord-bot' },
            dev: { type: 'none' },
            paths: ['discord-bot/'],
            actions: {
                prod: { type: 'rebuild', cmd: 'docker compose up -d --build discord-bot' },
                dev: null,
            },
        },
        {
            id: 'media-server',
            label: 'Media Server',
            prod: { type: 'docker', service: 'media-server' },
            dev: { type: 'none' },
            paths: ['nginx/nginx.conf'],
            actions: {
                prod: { type: 'restart', cmd: 'docker compose restart media-server' },
                dev: null,
            },
        },
    ],

    globalTriggers: ['docker-compose.yml', '.env'],

    polling: {
        health: 5000,
        github: 60000,
    },

    stateFile: '.hub-state.json',
};
