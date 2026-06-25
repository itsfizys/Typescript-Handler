import { Redis } from 'ioredis';
import { Rei, ReiT } from '#classes/rei';
import { logger } from '#utils';
import type { CacheConfig } from '../../types/index.js';

export class CacheManager {
        config: CacheConfig;
        type: string;
        fallbackType: string;
        redis: Redis | null;
        memory: ReiT;
        connected: boolean;
        useRedis: boolean;

        constructor(config: CacheConfig) {
                this.config = config;
                this.type = config.type;
                this.fallbackType = config.fallback;
                this.redis = null;
                this.memory = new ReiT(config.maxSize);
                this.connected = false;
                this.useRedis = false;
        }

        async init(): Promise<this> {
                if (this.type === 'redis' && this.config.url) {
                        try {
                                this.redis = new Redis(this.config.url, {
                                        maxRetriesPerRequest: 3,
                                        enableReadyCheck: true,
                                        lazyConnect: false,
                                        retryStrategy: (times: number) => {
                                                if (times > 3) {
                                                        logger.error('Cache', 'Max Redis retries reached, using fallback');
                                                        this.useRedis = false;
                                                        return null;
                                                }
                                                return Math.min(times * 200, 2000);
                                        },
                                });

                                this.redis.on('error', (err: Error) => {
                                        logger.error('Cache', `Redis error: ${err.message}`);
                                        this.useRedis = false;
                                });

                                this.redis.on('connect', () => {
                                        this.connected = true;
                                        this.useRedis = true;
                                        logger.success('Cache', 'Redis connected');
                                });

                                this.redis.on('close', () => {
                                        this.connected = false;
                                        this.useRedis = false;
                                        logger.warn('Cache', 'Redis connection closed');
                                });

                                await this.redis.ping();
                                logger.success('Cache', 'Cache manager initialized with Redis');
                        } catch (error) {
                                logger.error('Cache', `Redis init failed: ${(error as Error).message}`);
                                logger.warn('Cache', `Using ${this.fallbackType} fallback`);
                                this.useRedis = false;
                        }
                } else {
                        logger.info('Cache', 'Cache manager initialized with memory storage');
                }
                return this;
        }

        async set(k: string, v: unknown, ttl?: number): Promise<boolean> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                const val = typeof v === 'object' ? JSON.stringify(v) : String(v as string | number | boolean);
                                if (ttl) {
                                        await this.redis.setex(k, ttl, val);
                                } else {
                                        await this.redis.set(k, val);
                                }
                        } else {
                                this.memory.set(k, v, ttl);
                        }
                        return true;
                } catch {
                        this.memory.set(k, v, ttl);
                        return false;
                }
        }

        async setnxex(k: string, v: unknown, ttl: number): Promise<boolean> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                const val = typeof v === 'object' ? JSON.stringify(v) : String(v as string | number | boolean);
                                const result = await this.redis.set(k, val, 'EX', ttl, 'NX');
                                return result === 'OK';
                        }
                        if (this.memory.has(k)) return false;
                        this.memory.set(k, v, ttl);
                        return true;
                } catch {
                        if (this.memory.has(k)) return false;
                        this.memory.set(k, v, ttl);
                        return true;
                }
        }

        async get<T = unknown>(k: string): Promise<T | null> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                const val = await this.redis.get(k);
                                if (!val) return null;
                                try {
                                        return JSON.parse(val) as T;
                                } catch {
                                        return val as unknown as T;
                                }
                        }
                        return this.memory.get(k) as T | null;
                } catch {
                        return this.memory.get(k) as T | null;
                }
        }

        async has(k: string): Promise<boolean> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                return (await this.redis.exists(k)) === 1;
                        }
                        return this.memory.has(k);
                } catch {
                        return this.memory.has(k);
                }
        }

        async del(k: string): Promise<boolean> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                await this.redis.del(k);
                        }
                        this.memory.del(k);
                        return true;
                } catch {
                        this.memory.del(k);
                        return false;
                }
        }

        async mset(arr: [string, unknown][]): Promise<boolean> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                const pipe = this.redis.pipeline();
                                for (const [k, v] of arr) {
                                        const val = typeof v === 'object' ? JSON.stringify(v) : String(v as string | number | boolean);
                                        pipe.set(k, val);
                                }
                                await pipe.exec();
                        }
                        this.memory.mset(arr);
                        return true;
                } catch {
                        this.memory.mset(arr);
                        return false;
                }
        }

        async mget(keys: string[]): Promise<unknown[]> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                const vals = await this.redis.mget(...keys);
                                return vals.map((v: string | null) => {
                                        if (!v) return null;
                                        try {
                                                return JSON.parse(v);
                                        } catch {
                                                return v;
                                        }
                                });
                        }
                        return this.memory.mget(keys);
                } catch {
                        return this.memory.mget(keys);
                }
        }

        async mdel(keys: string[]): Promise<boolean> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                if (keys.length > 0) await this.redis.del(...keys);
                        }
                        this.memory.mdel(keys);
                        return true;
                } catch {
                        this.memory.mdel(keys);
                        return false;
                }
        }

        async incr(k: string, d = 1): Promise<number> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                return await this.redis.incrby(k, d);
                        }
                        return this.memory.incr(k, d);
                } catch {
                        return this.memory.incr(k, d);
                }
        }

        async decr(k: string, d = 1): Promise<number> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                return await this.redis.decrby(k, d);
                        }
                        return this.memory.decr(k, d);
                } catch {
                        return this.memory.decr(k, d);
                }
        }

        async keys(pattern = '*'): Promise<string[]> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                return await this.redis.keys(pattern);
                        }
                        return this.memory.keys(pattern);
                } catch {
                        return this.memory.keys(pattern);
                }
        }

        async hset(k: string, f: string, v: unknown): Promise<boolean> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                const val = typeof v === 'object' ? JSON.stringify(v) : String(v as string | number | boolean);
                                await this.redis.hset(k, f, val);
                        } else {
                                this.memory.hset(k, f, v);
                        }
                        return true;
                } catch {
                        this.memory.hset(k, f, v);
                        return false;
                }
        }

        async hget<T = unknown>(k: string, f: string): Promise<T | null> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                const val = await this.redis.hget(k, f);
                                if (!val) return null;
                                try {
                                        return JSON.parse(val) as T;
                                } catch {
                                        return val as unknown as T;
                                }
                        }
                        return this.memory.hget(k, f) as T | null;
                } catch {
                        return this.memory.hget(k, f) as T | null;
                }
        }

        async hdel(k: string, f: string): Promise<boolean> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                await this.redis.hdel(k, f);
                        }
                        this.memory.hdel(k, f);
                        return true;
                } catch {
                        this.memory.hdel(k, f);
                        return false;
                }
        }

        async hgetall<T extends Record<string, unknown> = Record<string, unknown>>(k: string): Promise<T> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                const obj = await this.redis.hgetall(k);
                                const parsed: Record<string, unknown> = {};
                                for (const [key, val] of Object.entries(obj) as [string, string][]) {
                                        try {
                                                parsed[key] = JSON.parse(val);
                                        } catch {
                                                parsed[key] = val;
                                        }
                                }
                                return parsed as T;
                        }
                        return this.memory.hgetall(k) as T;
                } catch {
                        return this.memory.hgetall(k) as T;
                }
        }

        async hmset(k: string, obj: Record<string, unknown>): Promise<boolean> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                const serialized: Record<string, string> = {};
                                for (const [key, val] of Object.entries(obj)) {
                                        serialized[key] = typeof val === 'object' ? JSON.stringify(val) : String(val as string | number | boolean);
                                }
                                await this.redis.hset(k, serialized);
                        }
                        this.memory.hmset(k, obj);
                        return true;
                } catch {
                        this.memory.hmset(k, obj);
                        return false;
                }
        }

        async hincrby(k: string, f: string, d = 1): Promise<number> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                return await this.redis.hincrby(k, f, d);
                        }
                        return this.memory.hincrby(k, f, d);
                } catch {
                        return this.memory.hincrby(k, f, d);
                }
        }

        async sadd(k: string, ...members: string[]): Promise<boolean> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                await this.redis.sadd(k, ...members);
                        }
                        this.memory.sadd(k, ...members);
                        return true;
                } catch {
                        this.memory.sadd(k, ...members);
                        return false;
                }
        }

        async smembers(k: string): Promise<string[]> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                return await this.redis.smembers(k);
                        }
                        return this.memory.smembers(k) as string[];
                } catch {
                        return this.memory.smembers(k) as string[];
                }
        }

        async sismember(k: string, m: string): Promise<boolean> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                return (await this.redis.sismember(k, m)) === 1;
                        }
                        return this.memory.sismember(k, m);
                } catch {
                        return this.memory.sismember(k, m);
                }
        }

        async srem(k: string, ...members: string[]): Promise<boolean> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                await this.redis.srem(k, ...members);
                        }
                        this.memory.srem(k, ...members);
                        return true;
                } catch {
                        this.memory.srem(k, ...members);
                        return false;
                }
        }

        async lpush(k: string, ...values: unknown[]): Promise<number> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                const serialized = values.map((v) =>
                                        typeof v === 'object' ? JSON.stringify(v) : String(v as string | number | boolean),
                                );
                                return await this.redis.lpush(k, ...serialized);
                        }
                        return this.memory.lpush(k, ...values);
                } catch {
                        return this.memory.lpush(k, ...values);
                }
        }

        async rpush(k: string, ...values: unknown[]): Promise<number> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                const serialized = values.map((v) =>
                                        typeof v === 'object' ? JSON.stringify(v) : String(v as string | number | boolean),
                                );
                                return await this.redis.rpush(k, ...serialized);
                        }
                        return this.memory.rpush(k, ...values);
                } catch {
                        return this.memory.rpush(k, ...values);
                }
        }

        async lpop<T = unknown>(k: string): Promise<T | null> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                const val = await this.redis.lpop(k);
                                if (!val) return null;
                                try {
                                        return JSON.parse(val) as T;
                                } catch {
                                        return val as unknown as T;
                                }
                        }
                        return this.memory.lpop(k) as T | null;
                } catch {
                        return this.memory.lpop(k) as T | null;
                }
        }

        async rpop<T = unknown>(k: string): Promise<T | null> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                const val = await this.redis.rpop(k);
                                if (!val) return null;
                                try {
                                        return JSON.parse(val) as T;
                                } catch {
                                        return val as unknown as T;
                                }
                        }
                        return this.memory.rpop(k) as T | null;
                } catch {
                        return this.memory.rpop(k) as T | null;
                }
        }

        async lrange<T = unknown>(k: string, start: number, stop: number): Promise<T[]> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                const vals = await this.redis.lrange(k, start, stop);
                                return vals.map((v: string) => {
                                        try {
                                                return JSON.parse(v) as T;
                                        } catch {
                                                return v as unknown as T;
                                        }
                                });
                        }
                        return this.memory.lrange(k, start, stop) as T[];
                } catch {
                        return this.memory.lrange(k, start, stop) as T[];
                }
        }

        async llen(k: string): Promise<number> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                return await this.redis.llen(k);
                        }
                        return this.memory.llen(k);
                } catch {
                        return this.memory.llen(k);
                }
        }

        async clear(): Promise<void> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                await this.redis.flushdb();
                        }
                        this.memory.clear();
                } catch {
                        this.memory.clear();
                }
        }

        async disconnect(): Promise<void> {
                try {
                        if (this.redis) {
                                await this.redis.quit();
                        }
                } catch {}
        }

        async ttl(k: string): Promise<number> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                return await this.redis.ttl(k);
                        }
                        return this.memory.ttl(k);
                } catch {
                        return this.memory.ttl(k);
                }
        }

        async ping(): Promise<number> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                const start = Date.now();
                                await this.redis.ping();
                                return Date.now() - start;
                        }
                        return -1;
                } catch {
                        return -1;
                }
        }

        async expire(k: string, seconds: number): Promise<boolean> {
                try {
                        if (this.useRedis && this.connected && this.redis) {
                                return (await this.redis.expire(k, seconds)) === 1;
                        }
                        this.memory.expire(k, seconds);
                        return true;
                } catch {
                        this.memory.expire(k, seconds);
                        return false;
                }
        }
}
