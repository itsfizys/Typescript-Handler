import { REST } from '@discordjs/rest';
import {
        Client,
        GatewayIntentBits,
        Options,
        type ClientOptions,
        type Message,
        type User,
        type GuildMember,
        type VoiceState,
} from 'discord.js';
import { config } from '#config';
import { db } from '#dbManager';
import { CommandHandler } from '#handlers/commandHandler';
import { EventLoader } from '#handlers/eventLoader';
import { logger } from '#utils';
import { CacheManager } from '#classes/cache';
import type { DatabaseManager } from '#dbManager';

export class Bot extends Client {
        cache: CacheManager;
        c: CacheManager;
        logger: typeof logger;
        config: typeof config;
        commandHandler: CommandHandler;
        eventHandler: EventLoader;
        db: DatabaseManager | null;

        constructor() {
                const clientOptions: ClientOptions = {
                        intents: [
                                GatewayIntentBits.Guilds,
                                GatewayIntentBits.GuildMessages,
                                GatewayIntentBits.MessageContent,
                                GatewayIntentBits.GuildMembers,
                        ],
                        partials: [],
                        allowedMentions: { parse: [], repliedUser: false },
                        makeCache: Options.cacheWithLimits({
                                MessageManager: {
                                        maxSize: 0,
                                        keepOverLimit: (msg: Message) => msg.author?.id === msg.client.user?.id,
                                },
                                ThreadManager: 0,
                                ThreadMemberManager: 0,
                                UserManager: {
                                        maxSize: 10,
                                        keepOverLimit: (user: User) => user.id === user.client.user?.id,
                                },
                                GuildMemberManager: {
                                        maxSize: 50,
                                        keepOverLimit: (member: GuildMember) => member.voice?.channelId != null,
                                },
                                ReactionManager: 0,
                                ReactionUserManager: 0,
                                PresenceManager: 0,
                                VoiceStateManager: {
                                        maxSize: 50,
                                        keepOverLimit: (vs: VoiceState) => vs.channelId != null,
                                },
                                StageInstanceManager: 0,
                                GuildBanManager: 0,
                                GuildInviteManager: 0,
                                ApplicationCommandManager: 0,
                                BaseGuildEmojiManager: 0,
                                GuildStickerManager: 0,
                                AutoModerationRuleManager: 0,
                                GuildScheduledEventManager: 0,
                        }),
                        sweepers: {
                                messages: {
                                        interval: 180,
                                        filter: () => (msg: Message) =>
                                                msg.author?.id !== msg.client.user?.id,
                                },
                                users: {
                                        interval: 300,
                                        filter: () => (user: User) => user.id !== user.client.user?.id,
                                },
                                guildMembers: {
                                        interval: 300,
                                        filter: () => (member: GuildMember) =>
                                                member.voice?.channelId == null && member.id !== member.client.user?.id,
                                },
                                threadMembers: {
                                        interval: 300,
                                        filter: () => () => true,
                                },
                                threads: {
                                        interval: 300,
                                        filter: () => () => true,
                                },
                        },
                        failIfNotExists: false,
                        ws: {
                                large_threshold: 50,
                        },
                        rest: {
                                timeout: 15000,
                                retries: 2,
                                hashLifetime: 300000,
                                hashSweepInterval: 300000,
                        },
                };

                super(clientOptions);
                this.cache = new CacheManager(config.cache);
                this.c = this.cache;
                this.logger = logger;
                this.config = config;
                this.commandHandler = new CommandHandler(this);
                this.eventHandler = new EventLoader(this);
                this.rest = new REST({ version: '10' }).setToken(config.token);
                this.db = null;
        }

        async init(): Promise<void> {
                try {
                        await this.c.init();
                        if (this.config.cache.flushOnStart) {
                                await this.c.clear();
                                this.logger.info('Bot', 'Cache flushed on startup');
                        }

                        this.db = db.init();
                        this.logger.info('Bot', 'Database initialized');

                        await this.eventHandler.loadAllEvents();
                        await this.commandHandler.loadCommands();
                        await this.login(config.token);
                } catch (error) {
                        this.logger.error('Bot', 'Failed to initialize bot:', error);
                        throw error;
                }
        }

        async cleanup(): Promise<void> {
                this.logger.warn('Bot', 'Starting cleanup...');
                try {
                        if (this.config.cache.flushOnShutdown) {
                                await this.c.clear();
                                this.logger.info('Bot', 'Cache flushed on shutdown');
                        } else {
                                await this.c.disconnect();
                        }

                        if (this.db) {
                                await this.db.closeAll();
                        }

                        this.destroy();
                        this.logger.success('Bot', 'Cleanup completed');
                } catch (error) {
                        this.logger.error('Bot', 'Cleanup error:', error);
                        throw error;
                }
        }
}
