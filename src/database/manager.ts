import { initDatabase, closeDatabase } from '#db/drizzle';
import { GuildService } from '#dbServices/guilds';
import { BlacklistService } from '#dbServices/blacklist';
import { logger } from '#utils';

export class DatabaseManager {
        guild: GuildService | null;
        blacklist: BlacklistService | null;
        initialized: boolean;

        constructor() {
                this.guild = null;
                this.blacklist = null;
                this.initialized = false;
        }

        init() {
                if (this.initialized) return this;

                try {
                        initDatabase();

                        this.guild = new GuildService();
                        this.blacklist = new BlacklistService();

                        this.initialized = true;
                        logger.success('DatabaseManager', 'Databases initialized successfully');
                } catch (error) {
                        logger.error('DatabaseManager', 'Failed to initialize databases', error);
                        throw error;
                }

                return this;
        }

        async closeAll() {
                if (!this.initialized) return;

                try {
                        await closeDatabase();
                        this.initialized = false;
                        logger.info('DatabaseManager', 'All database connections closed');
                } catch (error) {
                        logger.error('DatabaseManager', 'Failed to close database connections', error);
                        throw error;
                }
        }
}

let dbInstance: DatabaseManager | null = null;

export const getDb = () => {
        if (!dbInstance) {
                dbInstance = new DatabaseManager();
        }
        return dbInstance;
};

export const db = getDb();
