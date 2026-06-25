import { logger } from '#utils';
import type { Bot } from '#classes/client';
import type { DiscordEvent } from '../../../types/index.js';

export default class DiscordHandler {
        client: Bot;
        registeredEvents: Map<string, Set<(...args: unknown[]) => Promise<void>>>;

        constructor(client: Bot) {
                this.client = client;
                this.registeredEvents = new Map();
        }

        async register(event: DiscordEvent): Promise<boolean> {
                try {
                        const listener = async (...args: unknown[]): Promise<void> => {
                                try {
                                        await event.execute({ eventArgs: args, client: this.client });
                                } catch (error) {
                                        logger.error('DiscordEvent', `Error in Discord event ${event.name}:`, error);
                                }
                        };

                        if (event.once) {
                                this.client.once(event.name, listener);
                        } else {
                                this.client.on(event.name, listener);
                        }

                        if (!this.registeredEvents.has(event.name)) {
                                this.registeredEvents.set(event.name, new Set());
                        }
                        this.registeredEvents.get(event.name)!.add(listener);
                        return true;
                } catch (error) {
                        logger.error(
                                'DiscordEvent',
                                `Failed to register Discord event: ${event.name}`,
                                error,
                        );
                        return false;
                }
        }

        async unregister(eventName: string): Promise<void> {
                const listeners = this.registeredEvents.get(eventName);
                if (listeners) {
                        for (const listener of listeners) {
                                this.client.removeListener(eventName, listener);
                        }
                        this.registeredEvents.delete(eventName);
                }
        }

        async unregisterAll(): Promise<void> {
                for (const [eventName, listeners] of this.registeredEvents) {
                        for (const listener of listeners) {
                                this.client.removeListener(eventName, listener);
                        }
                }
                this.registeredEvents.clear();
        }
}
