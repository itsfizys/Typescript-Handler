import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '#utils';
import type { Bot } from '#classes/client';
import type { DiscordEvent } from '../../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface EventHandlerInstance {
        register(event: DiscordEvent): Promise<boolean>;
        unregister?(eventName: string): Promise<void>;
        unregisterAll?(): Promise<void>;
}

export class EventLoader {
        client: Bot;
        loadedEvents: Map<string, DiscordEvent[]>;
        handlers: Map<string, EventHandlerInstance>;
        eventsPath: string;
        handlersPath: string;

        constructor(client: Bot) {
                this.client = client;
                this.loadedEvents = new Map();
                this.handlers = new Map();
                this.eventsPath = path.join(__dirname, '../../events');
                this.handlersPath = path.join(__dirname, 'event-handlers');
        }

        async loadAllEvents(): Promise<boolean> {
                try {
                        await this.loadHandlers();
                        await this.loadEventsByType();

                        const totalEvents = Array.from(this.loadedEvents.values()).reduce(
                                (sum, events) => sum + events.length,
                                0,
                        );

                        logger.success('EventLoader', `Successfully loaded ${totalEvents} events`);
                        return true;
                } catch (error) {
                        logger.error('EventLoader', 'Failed to load events');
                        logger.error('EventLoader', (error as Error).message);
                        return false;
                }
        }

        async loadHandlers(): Promise<void> {
                try {
                        if (!fs.existsSync(this.handlersPath)) {
                                logger.warn('EventLoader', `Handlers directory not found: ${this.handlersPath}`);
                                return;
                        }

                        const handlerFiles = await fs.promises.readdir(this.handlersPath);

                        for (const file of handlerFiles) {
                                if (file.endsWith('.ts')) {
                                        const handlerPath = path.join(this.handlersPath, file);
                                        const handlerModule = await import(`file://${handlerPath}`) as { default?: new (client: Bot) => EventHandlerInstance };

                                        if (handlerModule?.default) {
                                                const handler = new handlerModule.default(this.client);
                                                const handlerName = file.replace('.ts', '').replace('-handler', '');
                                                this.handlers.set(handlerName, handler);
                                        }
                                }
                        }
                } catch (error) {
                        logger.error('EventLoader', 'Failed to load handlers', error);
                }
        }

        async loadEventsByType(): Promise<void> {
                try {
                        if (!fs.existsSync(this.eventsPath)) {
                                logger.warn('EventLoader', `Events directory not found: ${this.eventsPath}`);
                                return;
                        }

                        const eventTypeEntries = await fs.promises.readdir(this.eventsPath, {
                                withFileTypes: true,
                        });

                        for (const entry of eventTypeEntries) {
                                if (entry.isDirectory()) {
                                        const eventType = entry.name;
                                        const eventTypePath = path.join(this.eventsPath, eventType);

                                        if (this.handlers.has(eventType)) {
                                                await this.recursiveLoadEvents(eventTypePath, eventType);
                                        } else {
                                                logger.warn('EventLoader', `No handler found for event type: ${eventType}`);
                                        }
                                }
                        }
                } catch (error) {
                        logger.error('EventLoader', 'Failed to load events by type', error);
                }
        }

        async recursiveLoadEvents(dirPath: string, eventType: string): Promise<void> {
                try {
                        const entries = await fs.promises.readdir(dirPath, {
                                withFileTypes: true,
                        });

                        for (const entry of entries) {
                                const fullPath = path.join(dirPath, entry.name);

                                if (entry.isDirectory()) {
                                        await this.recursiveLoadEvents(fullPath, eventType);
                                } else if (entry.isFile() && entry.name.endsWith('.ts')) {
                                        await this.loadEventFile(fullPath, eventType);
                                }
                        }
                } catch (error) {
                        logger.error('EventLoader', `Failed to read directory: ${dirPath}`, error);
                }
        }

        async loadEventFile(filePath: string, eventType: string): Promise<void> {
                try {
                        const module = await import(`file://${filePath}`) as { default?: DiscordEvent };
                        if (!module?.default) return;

                        const event = module.default;
                        const handler = this.handlers.get(eventType);

                        if (!handler) {
                                logger.warn('EventLoader', `No handler found for event type: ${eventType}`);
                                return;
                        }

                        await handler.register(event);

                        if (!this.loadedEvents.has(eventType)) {
                                this.loadedEvents.set(eventType, []);
                        }
                        this.loadedEvents.get(eventType)!.push(event);
                } catch (error) {
                        logger.error('EventLoader', `Failed to load event: ${filePath}`);
                        logger.error('EventLoader', (error as Error).message);
                }
        }

        getLoadedEvents(): Record<string, DiscordEvent[]> {
                return Object.fromEntries(this.loadedEvents);
        }

        getHandlers(): string[] {
                return Array.from(this.handlers.keys());
        }

        getAvailableEventTypes(): string[] {
                try {
                        if (!fs.existsSync(this.eventsPath)) return [];

                        return fs
                                .readdirSync(this.eventsPath, { withFileTypes: true })
                                .filter((entry) => entry.isDirectory())
                                .map((entry) => entry.name);
                } catch (error) {
                        logger.error('EventLoader', 'Failed to get available event types', error);
                        return [];
                }
        }
}
