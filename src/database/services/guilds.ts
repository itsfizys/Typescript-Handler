import { GuildRepository } from '#dbRepo/guilds';
import { config } from '#config';
import { logger } from '#utils';

type AllowedSettingsKeys = 'prefixes' | 'ignoredChannels';

interface GuildSettings {
        prefixes?: string[];
        ignoredChannels?: string[];
}

export class GuildService {
        repo: GuildRepository;

        constructor() {
                this.repo = new GuildRepository();
        }

        async getGuild(guildId: string) {
                return await this.repo.findById(guildId);
        }

        async ensureGuild(guildId: string) {
                return await this.repo.findOrCreate(guildId);
        }

        async getPrefixes(guildId: string): Promise<string[]> {
                const guild = await this.ensureGuild(guildId);
                return guild.prefixes.length > 0 ? guild.prefixes : [config.prefix];
        }

        async setPrefixes(guildId: string, prefixes: string[]): Promise<void> {
                await this.ensureGuild(guildId);
                await this.repo.update(guildId, { prefixes });
        }

        async getIgnoredChannels(guildId: string): Promise<string[]> {
                const guild = await this.ensureGuild(guildId);
                return guild.ignoredChannels;
        }

        async setIgnoredChannels(guildId: string, channels: string[]): Promise<void> {
                await this.ensureGuild(guildId);
                await this.repo.update(guildId, { ignoredChannels: channels });
        }

        async isChannelIgnored(guildId: string, channelId: string): Promise<boolean> {
                const ignored = await this.getIgnoredChannels(guildId);
                return ignored.includes(channelId);
        }

        async getAllGuilds() {
                return await this.repo.findAll();
        }

        async updateSettings(guildId: string, settings: GuildSettings): Promise<number> {
                await this.ensureGuild(guildId);

                const allowedKeys: AllowedSettingsKeys[] = ['prefixes', 'ignoredChannels'];
                const updates: GuildSettings = {};

                for (const key of allowedKeys) {
                        if (settings[key] === undefined) continue;
                        updates[key] = settings[key] as string[];
                }

                if (Object.keys(updates).length === 0) return 0;

                await this.repo.update(guildId, updates);
                return Object.keys(updates).length;
        }

        async getAvatarUpdatedAt(guildId: string): Promise<Date | null> {
                const guild = await this.ensureGuild(guildId);
                return guild.avatarUpdatedAt;
        }

        async setAvatarUpdatedAt(guildId: string): Promise<boolean> {
                await this.ensureGuild(guildId);
                await this.repo.update(guildId, { avatarUpdatedAt: new Date() });
                return true;
        }

        async getBannerUpdatedAt(guildId: string): Promise<Date | null> {
                const guild = await this.ensureGuild(guildId);
                return guild.bannerUpdatedAt;
        }

        async setBannerUpdatedAt(guildId: string): Promise<boolean> {
                await this.ensureGuild(guildId);
                await this.repo.update(guildId, { bannerUpdatedAt: new Date() });
                return true;
        }

        async getBioUpdatedAt(guildId: string): Promise<Date | null> {
                const guild = await this.ensureGuild(guildId);
                return guild.bioUpdatedAt;
        }

        async setBioUpdatedAt(guildId: string): Promise<boolean> {
                await this.ensureGuild(guildId);
                await this.repo.update(guildId, { bioUpdatedAt: new Date() });
                return true;
        }

        async getCustomProfileStatus(guildId: string): Promise<boolean> {
                const guild = await this.ensureGuild(guildId);
                return guild.isCustomProfile;
        }

        async setCustomProfileStatus(guildId: string, status: boolean): Promise<void> {
                await this.ensureGuild(guildId);
                await this.repo.update(guildId, { isCustomProfile: status });
        }

        async deleteGuild(guildId: string): Promise<void> {
                if (!guildId) {
                        logger.error('GuildService', 'Cannot delete guild: no guildId provided');
                        return;
                }

                await this.repo.delete(guildId);
        }
}
