import { logger } from '#utils';
import { ActivityType } from 'discord.js';
import type { EventExecuteContext } from '../../types/index.js';

export default {
        name: 'clientReady',
        once: true,
        async execute({ client }: EventExecuteContext): Promise<void> {
                logger.success('Bot', `Logged in as ${client.user!.tag}`);

                client.user!.setPresence({
                        activities: [{ name: 'lost in sound, found at 11 ✨️', type: ActivityType.Custom }],
                        status: 'idle',
                });

                logger.info('Bot', `Serving ${client.guilds.cache.size} guilds`);
        },
};
