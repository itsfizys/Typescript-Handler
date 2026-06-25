import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '#utils';
import type { Bot } from '#classes/client';
import type { Command } from '#classes/command';
import type { SlashCommandData } from '../../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BTN_COOLDOWN_MS = 3_000;

interface SlashSubcommandOption {
        name: string;
        description: string;
        type: 1;
        options: SlashCommandData['options'];
}

interface SlashSubcommandGroupOption {
        name: string;
        description: string;
        type: 2;
        options: SlashSubcommandOption[];
}

interface SlashCommandEntry {
        name: string;
        description: string;
        options: (SlashSubcommandOption | SlashSubcommandGroupOption | NonNullable<SlashCommandData['options']>[number])[];
        default_member_permissions?: string;
}

export class CommandHandler {
        client: Bot;
        commands: Map<string, Command>;
        aliases: Map<string, string>;
        arrayCommands: Map<string, Command[]>;
        slashCommands: Map<string, SlashCommandEntry>;
        slashCommandFiles: Map<string, Command>;
        categories: Map<string, Command[]>;
        commandPaths: Map<string, string>;

        constructor(client: Bot) {
                this.client = client;
                this.commands = new Map();
                this.aliases = new Map();
                this.arrayCommands = new Map();
                this.slashCommands = new Map();
                this.slashCommandFiles = new Map();
                this.categories = new Map();
                this.commandPaths = new Map();
        }

        async loadCommands(dirPath = '../../commands'): Promise<void> {
                logger.info('CommandHandler', 'Loading commands...');
                this.commands.clear();
                this.aliases.clear();
                this.arrayCommands.clear();
                this.slashCommands.clear();
                this.slashCommandFiles.clear();
                this.categories.clear();
                this.commandPaths.clear();

                const commandsAbsolutePath = path.join(__dirname, dirPath);

                try {
                        await this._recursivelyLoadCommands(commandsAbsolutePath);
                        this._finalizeSlashCommands();
                        logger.success(
                                'CommandHandler',
                                `Loaded ${this.commands.size} prefix and ${this.slashCommandFiles.size} slash commands.`,
                        );
                } catch (error) {
                        logger.error('CommandHandler', 'Failed to load commands', error);
                }
        }

        async _recursivelyLoadCommands(dirPath: string, relativePath = ''): Promise<void> {
                try {
                        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

                        const loadPromises = entries.map(async (entry) => {
                                const fullPath = path.join(dirPath, entry.name);
                                const currentRelativePath = relativePath
                                        ? path.join(relativePath, entry.name)
                                        : entry.name;

                                if (entry.isDirectory()) {
                                        await this._recursivelyLoadCommands(fullPath, currentRelativePath);
                                } else if (entry.isFile() && entry.name.endsWith('.ts')) {
                                        const category = relativePath || 'default';

                                        if (!this.categories.has(category)) {
                                                this.categories.set(category, []);
                                        }
                                        await this._loadCommandFile(fullPath, category);
                                }
                        });

                        await Promise.all(loadPromises);
                } catch (error) {
                        logger.error('CommandHandler', `Failed to read directory: ${dirPath}`, error);
                        throw error;
                }
        }

        async _loadCommandFile(filePath: string, category: string): Promise<void> {
                try {
                        const commandModule = await import(`file://${filePath}`) as { default?: Command };

                        if (!commandModule?.default) {
                                logger.warn(
                                        'CommandHandler',
                                        `Invalid command file: ${path.basename(filePath)} is missing a default export.`,
                                );
                                return;
                        }

                        const command = commandModule.default;
                        command.category = category;

                        if (Array.isArray(command.name)) {
                                const firstPart = command.name[0]?.toLowerCase() ?? '';

                                if (command.name.length > 1) {
                                        if (!this.arrayCommands.has(firstPart)) {
                                                this.arrayCommands.set(firstPart, []);
                                        }
                                        this.arrayCommands.get(firstPart)!.push(command);
                                }

                                const arrayKey = command.name.join(':').toLowerCase();
                                this.commands.set(arrayKey, command);
                                this.commandPaths.set(arrayKey, filePath);
                        } else {
                                const cmdName = command.name.toLowerCase();
                                this.commandPaths.set(cmdName, filePath);
                                this.commands.set(cmdName, command);
                        }

                        if (command.aliases?.length) {
                                if (Array.isArray(command.name)) {
                                        const arrayKey = command.name.join(':').toLowerCase();
                                        command.aliases.forEach((alias) =>
                                                this.aliases.set(alias.toLowerCase(), arrayKey),
                                        );
                                } else {
                                        const cmdName = command.name.toLowerCase();
                                        command.aliases.forEach((alias) =>
                                                this.aliases.set(alias.toLowerCase(), cmdName),
                                        );
                                }
                        }

                        if (command.enabledSlash && command.slashData) {
                                const slashKey = Array.isArray(command.slashData.name)
                                        ? command.slashData.name.join(':')
                                        : command.slashData.name;
                                this.slashCommandFiles.set(slashKey, command);
                        }

                        this.categories.get(category)?.push(command);
                } catch (error) {
                        logger.error(
                                'CommandHandler',
                                `Failed to load command file: ${path.basename(filePath)}`,
                                error,
                        );
                }
        }

        _finalizeSlashCommands(): void {
                for (const command of this.slashCommandFiles.values()) {
                        if (!command.slashData) continue;
                        const { name, description, options, defaultMemberPermissions } = command.slashData;

                        if (Array.isArray(name)) {
                                if (name.length === 2) {
                                        const [main, sub] = name as [string, string];
                                        let mainCmd = this.slashCommands.get(main);

                                        if (!mainCmd) {
                                                mainCmd = {
                                                        name: main,
                                                        description: `${main} commands`,
                                                        options: [],
                                                };
                                                if (defaultMemberPermissions) {
                                                        mainCmd.default_member_permissions = defaultMemberPermissions.toString();
                                                }
                                                this.slashCommands.set(main, mainCmd);
                                        }

                                        const hasSubcommands = options?.some((opt) => (opt as { type: number }).type === 1);

                                        if (hasSubcommands) {
                                                let groupObj = mainCmd.options?.find(
                                                        (opt): opt is SlashSubcommandGroupOption =>
                                                                (opt as SlashSubcommandGroupOption).name === sub && (opt as SlashSubcommandGroupOption).type === 2,
                                                );

                                                if (!groupObj) {
                                                        groupObj = {
                                                                name: sub,
                                                                description: description ?? `${sub} commands`,
                                                                type: 2,
                                                                options: [],
                                                        } satisfies SlashSubcommandGroupOption;
                                                        mainCmd.options?.push(groupObj);
                                                }

                                                options?.forEach((opt) => {
                                                        if ((opt as { type: number }).type === 1) {
                                                                groupObj!.options.push(opt as SlashSubcommandOption);
                                                        }
                                                });
                                        } else {
                                                const subCmd: SlashSubcommandOption = {
                                                        name: sub,
                                                        description,
                                                        options: options ?? [],
                                                        type: 1,
                                                };
                                                mainCmd.options?.push(subCmd);
                                        }
                                } else if (name.length === 3) {
                                        const [main, group, sub] = name as [string, string, string];
                                        let mainCmd = this.slashCommands.get(main);

                                        if (!mainCmd) {
                                                mainCmd = {
                                                        name: main,
                                                        description: `${main} commands`,
                                                        options: [],
                                                };
                                                if (defaultMemberPermissions) {
                                                        mainCmd.default_member_permissions = defaultMemberPermissions.toString();
                                                }
                                                this.slashCommands.set(main, mainCmd);
                                        }

                                        let groupObj = mainCmd.options?.find(
                                                (opt): opt is SlashSubcommandGroupOption =>
                                                        (opt as SlashSubcommandGroupOption).name === group && (opt as SlashSubcommandGroupOption).type === 2,
                                        );

                                        if (!groupObj) {
                                                groupObj = {
                                                        name: group,
                                                        description: `${group} group under ${main}`,
                                                        type: 2,
                                                        options: [],
                                                } satisfies SlashSubcommandGroupOption;
                                                mainCmd.options?.push(groupObj);
                                        }

                                        const subCmd: SlashSubcommandOption = {
                                                name: sub,
                                                description,
                                                options: options ?? [],
                                                type: 1,
                                        };
                                        groupObj.options.push(subCmd);
                                } else {
                                        logger.warn(
                                                'CommandHandler',
                                                `Unsupported slashData.name depth for command: ${String(command.name)}`,
                                        );
                                }
                        } else {
                                const cmdData: SlashCommandEntry = {
                                        name,
                                        description,
                                        options: options ?? [],
                                };
                                if (defaultMemberPermissions) {
                                        cmdData.default_member_permissions = defaultMemberPermissions.toString();
                                }
                                this.slashCommands.set(name, cmdData);
                        }
                }
        }

        getSlashCommandsData(): SlashCommandEntry[] {
                return Array.from(this.slashCommands.values());
        }

        async setCooldown(command: Command, userId: string, guildId: string): Promise<void> {
                const commandKey = Array.isArray(command.name)
                        ? command.name.join(':').toLowerCase()
                        : command.name.toLowerCase();

                const cooldown = command.cooldown;

                if (cooldown) {
                        const cooldownKey = `cd:${commandKey}:${userId}:${guildId}`;
                        await this.client.c.set(cooldownKey, Date.now() + cooldown * 1000, cooldown);
                        await this.client.c.del(`cdn:${cooldownKey}`);
                }
        }

        async isOnCooldown(command: Command, userId: string, guildId: string): Promise<number | null> {
                const cooldown = command.cooldown;
                if (!cooldown) return null;

                const commandKey = Array.isArray(command.name)
                        ? command.name.join(':').toLowerCase()
                        : command.name.toLowerCase();

                const cooldownKey = `cd:${commandKey}:${userId}:${guildId}`;
                const cooldownValue = await this.client.c.get<number>(cooldownKey);

                if (!cooldownValue) return null;

                const remaining = cooldownValue - Date.now();

                if (remaining > 0) {
                        return remaining;
                } else {
                        await this.client.c.del(cooldownKey);
                        await this.client.c.del(`cdn:${cooldownKey}`);
                        return null;
                }
        }

        async shouldNotifyAboutCooldown(command: Command, userId: string, guildId: string): Promise<boolean> {
                const commandKey = Array.isArray(command.name)
                        ? command.name.join(':').toLowerCase()
                        : command.name.toLowerCase();

                const cooldownKey = `cd:${commandKey}:${userId}:${guildId}`;
                const hasNotified = await this.client.c.get(`cdn:${cooldownKey}`);

                if (!hasNotified) {
                        await this.client.c.set(`cdn:${cooldownKey}`, 1, command.cooldown);
                        return true;
                }

                return false;
        }

        async setButtonCooldown(customId: string, userId: string, guildId: string, ms = BTN_COOLDOWN_MS): Promise<void> {
                const key = `cd:btn:${customId}:${userId}:${guildId}`;
                await this.client.c.set(key, Date.now() + ms, Math.ceil(ms / 1000) + 1);
        }

        async isButtonOnCooldown(customId: string, userId: string, guildId: string): Promise<number | null> {
                const key = `cd:btn:${customId}:${userId}:${guildId}`;
                const val = await this.client.c.get<number>(key);
                if (!val) return null;
                const remaining = val - Date.now();
                if (remaining > 0) return remaining;
                await this.client.c.del(key);
                return null;
        }

        async checkAndSetButtonCooldown(customId: string, userId: string, guildId: string, ms = BTN_COOLDOWN_MS): Promise<number | null> {
                const key = `cd:btn:${customId}:${userId}:${guildId}`;
                const ttlSeconds = Math.ceil(ms / 1000) + 1;
                const expiry = Date.now() + ms;
                const wasSet = await this.client.c.setnxex(key, expiry, ttlSeconds);
                if (wasSet) return null;
                const val = await this.client.c.get<number>(key);
                if (!val) return null;
                const remaining = val - Date.now();
                return remaining > 0 ? remaining : null;
        }
}
