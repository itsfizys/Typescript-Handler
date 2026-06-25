import { eq } from 'drizzle-orm';
import { getDatabase } from '#db/drizzle';
import { blacklist } from '#dbSchema/index';
import { client } from '#src/bot';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

type BlacklistRecord = InferSelectModel<typeof blacklist>;
type BlacklistInsert = InferInsertModel<typeof blacklist>;

const CACHE_TTL = 36000;
const CACHE_PREFIX = 'blacklist:';

export class BlacklistRepository {
        db: ReturnType<typeof getDatabase>;

        constructor() {
                this.db = getDatabase();
        }

        async findById(id: string): Promise<BlacklistRecord | null> {
                if (!id) return null;

                const cacheKey = `${CACHE_PREFIX}${id}`;
                const cached = await client.c.get<BlacklistRecord>(cacheKey);
                if (cached !== null && cached !== undefined) return cached;

                const [entry] = await this.db
                        .select()
                        .from(blacklist)
                        .where(eq(blacklist.id, id))
                        .limit(1);

                const result = entry ?? null;
                if (result) {
                        await client.c.set(cacheKey, result, CACHE_TTL);
                }

                return result;
        }

        async exists(id: string): Promise<boolean> {
                if (!id) return false;

                const cacheKey = `${CACHE_PREFIX}exists:${id}`;
                const cached = await client.c.get<boolean>(cacheKey);
                if (cached !== null && cached !== undefined) return cached;

                const entry = await this.findById(id);
                const result = entry !== null;

                await client.c.set(cacheKey, result, CACHE_TTL);
                return result;
        }

        async create(data: BlacklistInsert): Promise<void> {
                if (!data?.id) return;

                await this.db.insert(blacklist).values(data);

                await Promise.all([
                        client.c.set(`${CACHE_PREFIX}${data.id}`, data, CACHE_TTL),
                        client.c.set(`${CACHE_PREFIX}exists:${data.id}`, true, CACHE_TTL),
                        this._invalidateListCaches(data.type),
                ]);
        }

        async delete(id: string): Promise<void> {
                if (!id) return;

                const entry = await this.findById(id);
                await this.db.delete(blacklist).where(eq(blacklist.id, id));

                await this._invalidateCaches(id, entry?.type);
        }

        async findAll(): Promise<BlacklistRecord[]> {
                const cacheKey = `${CACHE_PREFIX}all`;
                const cached = await client.c.get<BlacklistRecord[]>(cacheKey);
                if (cached !== null && cached !== undefined) return cached;

                const result = await this.db.select().from(blacklist);
                await client.c.set(cacheKey, result, 600);

                return result;
        }

        async findByType(type: 'user' | 'guild'): Promise<BlacklistRecord[]> {
                const cacheKey = `${CACHE_PREFIX}type:${type}`;
                const cached = await client.c.get<BlacklistRecord[]>(cacheKey);
                if (cached !== null && cached !== undefined) return cached;

                const result = await this.db.select().from(blacklist).where(eq(blacklist.type, type));

                await client.c.set(cacheKey, result, CACHE_TTL);
                return result;
        }

        async deleteByType(type: 'user' | 'guild'): Promise<void> {
                await this.db.delete(blacklist).where(eq(blacklist.type, type));
                await this._invalidateTypeCaches();
        }

        private async _invalidateCaches(id: string, type?: 'user' | 'guild'): Promise<void> {
                const keys = [
                        `${CACHE_PREFIX}${id}`,
                        `${CACHE_PREFIX}exists:${id}`,
                        `${CACHE_PREFIX}all`,
                ];

                if (type) {
                        keys.push(`${CACHE_PREFIX}type:${type}`);
                }

                await client.c.mdel(keys);
        }

        private async _invalidateListCaches(type?: 'user' | 'guild'): Promise<void> {
                const keys = [`${CACHE_PREFIX}all`];
                if (type) {
                        keys.push(`${CACHE_PREFIX}type:${type}`);
                }
                await client.c.mdel(keys);
        }

        private async _invalidateTypeCaches(): Promise<void> {
                const pattern = `${CACHE_PREFIX}*`;
                const keys = await client.c.keys(pattern);
                await client.c.mdel(keys);
        }
}
