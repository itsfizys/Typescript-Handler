import type { AppConfig } from '../types/index.js';

type EnvConfig = Omit<AppConfig, 'prefix' | 'ownerIds' | 'colors' | 'links' | 'watermark' | 'version' | 'environment'>;

export const devConfig: EnvConfig = {
        token: process.env.TOKEN!,
        clientId: '1487673716015108208',
        cache: {
                type: 'redis',
                url: process.env.REDIS_URL,
                fallback: 'memory',
                maxSize: 50000,
                flushOnStart: false,
                flushOnShutdown: false,
        },
        database: {
                url: process.env.DATABASE_URL!,
                max_connections: 10,
                connect_timeout: 10,
                max_lifetime: 60,
                logger: false,
        },
        debug: true,
};
