import 'dotenv/config';
import { devConfig } from './config.dev.js';
import { prodConfig } from './config.prod.js';
import type { AppConfig } from '../types/index.js';

const environment = process.env.NODE_ENV ?? 'development';
const envConfig = environment === 'production' ? prodConfig : devConfig;

const commonConfig = {
        prefix: '.',
        ownerIds: ['1124248109472550993', '544047377540186114'],
        colors: {
                bot: [214, 211, 203] as [number, number, number],
                error: [230, 190, 175] as [number, number, number],
                success: [140, 200, 170] as [number, number, number],
                warn: [255, 190, 120] as [number, number, number],
        },
        links: {
                supportServer: 'https://discord.gg/aerox',
                invite: 'https://discord.com/oauth2/authorize?client_id=1277525844319014955&permissions=4820258979704064&integration_type=0&scope=bot+applications.commands',
        },
        watermark: 'coded by itsfizys',
        version: '1.1.0',
};

export const config: AppConfig = {
        ...commonConfig,
        ...envConfig,
        environment,
};
