import { BlacklistRepository } from '#dbRepo/blacklist';

export class BlacklistService {
        repo: BlacklistRepository;

        constructor() {
                this.repo = new BlacklistRepository();
        }

        async checkBlacklist(id: string) {
                return await this.repo.exists(id);
        }

        async getBlacklist(id: string) {
                return await this.repo.findById(id);
        }

        async blacklistUser(userId: string, blacklistedBy: string, reason: string) {
                if (await this.checkBlacklist(userId)) {
                        return await this.getBlacklist(userId);
                }

                const data = {
                        id: userId,
                        blacklistedBy,
                        reason,
                        type: 'user' as const,
                        createdAt: new Date(),
                };

                await this.repo.create(data);

                return data;
        }

        async blacklistGuild(guildId: string, blacklistedBy: string, reason: string) {
                if (await this.checkBlacklist(guildId)) {
                        return await this.getBlacklist(guildId);
                }

                const data = {
                        id: guildId,
                        blacklistedBy,
                        reason,
                        type: 'guild' as const,
                        createdAt: new Date(),
                };

                await this.repo.create(data);

                return data;
        }

        async unblacklist(id: string) {
                if (!(await this.checkBlacklist(id))) return false;
                await this.repo.delete(id);

                return true;
        }

        async getAllBlacklist(type?: 'user' | 'guild') {
                if (type) {
                        return await this.repo.findByType(type);
                }
                return await this.repo.findAll();
        }

        async unblacklistType(type: 'user' | 'guild') {
                await this.repo.deleteByType(type);
        }

        async unblacklistGuilds() {
                await this.unblacklistType('guild');
        }

        async unblacklistUsers() {
                await this.unblacklistType('user');
        }
}
