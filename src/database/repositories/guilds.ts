import { eq, sql } from 'drizzle-orm';
import { getDatabase } from '#db/drizzle';
import { guilds } from '#dbSchema/index';
import { config } from '#config';
import { client } from '#src/bot';
import type { InferSelectModel } from 'drizzle-orm';

type GuildRecord = InferSelectModel<typeof guilds>;
type GuildUpdate = Partial<Omit<GuildRecord, 'id'>>;

const CACHE_TTL = 18000;
const CACHE_PREFIX = 'guild:';

export class GuildRepository {
        db: ReturnType<typeof getDatabase>;

        constructor() {
                this.db = getDatabase();
        }

        async findById(guildId: string): Promise<GuildRecord | null> {
                if (!guildId) return null;

                const cacheKey = `${CACHE_PREFIX}${guildId}`;
                const cached = await client.c.get<GuildRecord>(cacheKey);
                if (cached !== null && cached !== undefined) return cached;

                const [guild] = await this.db
                        .select()
                        .from(guilds)
                        .where(eq(guilds.id, guildId))
                        .limit(1);

                const result = guild ?? null;
                if (result) {
                        await client.c.set(cacheKey, result, CACHE_TTL);
                }

                return result;
        }

        async findOrCreate(guildId: string): Promise<GuildRecord> {
                if (!guildId) {
                        throw new Error('Invalid guildId');
                }

                const existing = await this.findById(guildId);

                if (!existing) {
                        const now = new Date();
                        const newGuild: GuildRecord = {
                                id: guildId,
                                prefixes: [config.prefix],
                                ignoredChannels: [],
                                isCustomProfile: false,
                                avatarUpdatedAt: null,
                                bannerUpdatedAt: null,
                                bioUpdatedAt: null,
                                createdAt: now,
                                updatedAt: now,
                        };

                        await this.db.insert(guilds).values(newGuild);

                        await Promise.all([
                                client.c.set(`${CACHE_PREFIX}${guildId}`, newGuild, CACHE_TTL),
                                this._invalidateListCaches(),
                        ]);

                        return newGuild;
                }

                return existing;
        }

        async update(guildId: string, data: GuildUpdate): Promise<void> {
                if (!guildId) return;

                const updateData = { ...data, updatedAt: new Date() };
                await this.db.update(guilds).set(updateData).where(eq(guilds.id, guildId));

                await this._invalidateGuildCaches(guildId);
        }

        async delete(guildId: string): Promise<void> {
                if (!guildId) return;

                await this.db.delete(guilds).where(eq(guilds.id, guildId));
                await this._invalidateGuildCaches(guildId);
        }

        async findAll(): Promise<GuildRecord[]> {
                const cacheKey = `${CACHE_PREFIX}all`;
                const cached = await client.c.get<GuildRecord[]>(cacheKey);
                if (cached !== null && cached !== undefined) return cached;

                const result = await this.db.select().from(guilds);
                await client.c.set(cacheKey, result, 1800);

                return result;
        }

        async incrementField(guildId: string, field: keyof GuildRecord, amount = 1): Promise<void> {
                if (!guildId || !field) return;

                await this.db
                        .update(guilds)
                        .set({
                                [field]: sql`${guilds[field as keyof typeof guilds]} + ${amount}`,
                                updatedAt: new Date(),
                        })
                        .where(eq(guilds.id, guildId));

                await client.c.del(`${CACHE_PREFIX}${guildId}`);
        }

        private async _invalidateGuildCaches(guildId: string): Promise<void> {
                const keys = [`${CACHE_PREFIX}${guildId}`, `${CACHE_PREFIX}all`];
                await client.c.mdel(keys);
        }

        private async _invalidateListCaches(): Promise<void> {
                await client.c.mdel([`${CACHE_PREFIX}all`, `${CACHE_PREFIX}247:enabled`]);
        }
}
