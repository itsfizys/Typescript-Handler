import {
        ContainerBuilder,
        TextDisplayBuilder,
        ButtonBuilder,
        ButtonStyle,
        MessageFlags,
        SeparatorBuilder,
        SeparatorSpacingSize,
        ActionRowBuilder,
        type Message,
        type TextBasedChannel,
        type User,
} from 'discord.js';
import { config } from '#config';
import { db } from '#dbManager';
import { CommandContext } from '#context';
import { validateCommand, canBotSendMessages, logger } from '#utils';
import { emoji } from '#emoji';
import type { Bot } from '#classes/client';
import type { Command } from '#classes/command';
import type { EventExecuteContext } from '../../../types/index.js';

const CUSTOM_PREFIXES: { GLOBAL: string[]; USER_SPECIFIC: Record<string, string[]> } = {
        GLOBAL: ['bot'],
        USER_SPECIFIC: {},
};

const regexCache = new Map<string, RegExp>();

const getMentionRegex = (id: string | undefined): RegExp | null => {
        if (!id) return null;
        if (!regexCache.has(id)) regexCache.set(id, new RegExp(`^<@!?${id}>\\s*$`));
        return regexCache.get(id)!;
};

const getMentionPrefixRegex = (id: string | undefined): RegExp | null => {
        if (!id) return null;
        const key = `p_${id}`;
        if (!regexCache.has(key)) regexCache.set(key, new RegExp(`^<@!?${id}>\\s+`));
        return regexCache.get(key)!;
};

const sendDM = async (user: User, title: string, description: string, client: Bot): Promise<boolean> => {
        if (!user || !title || !description || !client) return false;
        try {
                const dmCooldown = await client.commandHandler
                        ?.isOnCooldown({ name: 'errorDM', cooldown: 600 } as Command, user.id, user.id)
                        .catch(() => false);
                if (dmCooldown) return false;

                const dmContainer = new ContainerBuilder();
                dmContainer.setAccentColor(config.colors.error);
                dmContainer
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`### ${emoji.cross} ${title}`),
                        )
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(description));

                await user.send({ components: [dmContainer], flags: MessageFlags.IsComponentsV2 });

                if (client.commandHandler) {
                        await client.commandHandler
                                .setCooldown({ name: 'errorDM', cooldown: 600 } as Command, user.id, user.id)
                                .catch(() => {});
                }
                return true;
        } catch (error) {
                logger.debug('PrefixCmd', `Failed to DM user ${user.id}: ${(error as Error).message}`);
                return false;
        }
};

const sendError = async (message: Message, title: string, description: string, client: Bot): Promise<void> => {
        if (!message || !title || !description) return;
        try {
                if (!canBotSendMessages(message.channel as TextBasedChannel)) {
                        return void (await sendDM(message.author, title, description, client));
                }

                const errorContainer = new ContainerBuilder();
                errorContainer.setAccentColor(config.colors.error);
                errorContainer
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`### ${emoji.cross} ${title}`),
                        )
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(description));

                await message
                        .reply({ components: [errorContainer], flags: MessageFlags.IsComponentsV2 })
                        .catch(async () => {
                                await sendDM(message.author, title, description, client);
                        });
        } catch (error) {
                logger.debug('PrefixCmd', `Failed to send error: ${(error as Error).message}`);
        }
};

const sendCooldown = async (cooldown: number, message: Message): Promise<void> => {
        if (!cooldown || !message || !canBotSendMessages(message.channel as TextBasedChannel)) return;
        try {
                const timestamp = Math.floor((Date.now() + cooldown) / 1000);
                const content = `**Cooldown** - Ends <t:${timestamp}:R>`;

                const cooldownContainer = new ContainerBuilder();
                cooldownContainer.setAccentColor(config.colors.warn);
                cooldownContainer.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(content),
                );

                const reply = await message.reply({
                        components: [cooldownContainer],
                        flags: MessageFlags.IsComponentsV2,
                });
                setTimeout(() => reply.delete().catch(() => {}), cooldown);
        } catch {}
};

const parseMentionPrefix = (
        content: string,
        clientId: string | undefined,
): { parts: string[]; type: string } | null => {
        if (!content || !clientId) return null;
        try {
                const regex = getMentionPrefixRegex(clientId);
                if (!regex) return null;
                const match = content.match(regex);
                if (!match) return null;
                const parts = content.slice(match[0].length).trim().split(/\s+/);
                return parts.length > 0 ? { parts, type: 'mention' } : null;
        } catch {
                return null;
        }
};

const parseGuildPrefix = async (
        content: string,
        guildPrefixes: string[],
): Promise<{ parts: string[]; type: string; prefix: string } | null> => {
        if (!content || !guildPrefixes.length) return null;
        try {
                const lowerContent = content.toLowerCase();
                for (const prefix of guildPrefixes) {
                        if (lowerContent.startsWith(prefix.toLowerCase())) {
                                const parts = content.slice(prefix.length).trim().split(/\s+/);
                                return parts.length > 0 ? { parts, type: 'guild', prefix } : null;
                        }
                }
                return null;
        } catch {
                return null;
        }
};

const parseCustomPrefix = (
        content: string,
        userId: string,
): { parts: string[]; type: string } | null => {
        if (!content) return null;
        try {
                const userPrefixes = CUSTOM_PREFIXES.USER_SPECIFIC[userId];
                const allPrefixes = userPrefixes
                        ? [...CUSTOM_PREFIXES.GLOBAL, ...userPrefixes]
                        : CUSTOM_PREFIXES.GLOBAL;
                const lowerContent = content.toLowerCase();
                for (const prefix of allPrefixes) {
                        if (lowerContent.startsWith(prefix.toLowerCase())) {
                                const parts = content.slice(prefix.length).trim().split(/\s+/);
                                return parts.length > 0 ? { parts, type: 'custom' } : null;
                        }
                }
                return null;
        } catch {
                return null;
        }
};

const parseCommand = async (
        message: Message,
        client: Bot,
        guildPrefixes: string[],
): Promise<{ parts: string[]; type: string } | null> => {
        if (!message?.content) return null;
        try {
                const content = message.content.trim();
                return (
                        parseMentionPrefix(content, client.user?.id) ||
                        (await parseGuildPrefix(content, guildPrefixes)) ||
                        parseCustomPrefix(content, message.author?.id)
                );
        } catch {
                return null;
        }
};

const handleMentionOnly = async (message: Message, client: Bot, guildPrefixes: string[]): Promise<boolean> => {
        if (!message || !client?.user || !guildPrefixes.length) return false;
        try {
                const mentionRegex = getMentionRegex(client.user.id);
                if (!mentionRegex || !mentionRegex.test(message.content.trim())) return false;

                const mentionCooldown = await client.commandHandler
                        ?.isOnCooldown(
                                { name: 'botmention', cooldown: 30 } as Command,
                                message.author.id,
                                message.guild!.id,
                        )
                        .catch(() => false);
                if (mentionCooldown) return true;
                if (!canBotSendMessages(message.channel as TextBasedChannel)) return true;

                const mentionContainer = new ContainerBuilder();
                mentionContainer.setAccentColor(config.colors.bot);

                const mentionSeparator = new SeparatorBuilder()
                        .setSpacing(SeparatorSpacingSize.Small)
                        .setDivider(true);

                const mentionButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                                .setLabel('Support')
                                .setURL(config.links.supportServer)
                                .setStyle(ButtonStyle.Link),
                );

                mentionContainer
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`## ${client.user.username}`),
                        )
                        .addSeparatorComponents(mentionSeparator)
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                        `${emoji.code} **Server Prefixes**\n\n` +
                                                `-# ${guildPrefixes.map((p) => `\`${p}\``).join(' • ')}` +
                                                `\n\n-# Use \`${guildPrefixes[0]!}help\` for commands\n`,
                                ),
                        )
                        .addActionRowComponents(mentionButtons);

                await message
                        .reply({ components: [mentionContainer], flags: MessageFlags.IsComponentsV2 })
                        .catch(() => {});

                if (client.commandHandler) {
                        await client.commandHandler
                                .setCooldown(
                                        { name: 'botmention', cooldown: 30 } as Command,
                                        message.author.id,
                                        message.guild!.id,
                                )
                                .catch(() => {});
                }
                return true;
        } catch {
                return false;
        }
};

const getCommand = (
        parts: string[],
        commandHandler: Bot['commandHandler'],
): { command: Command | null; args: string[] } => {
        if (!parts.length || !commandHandler) return { command: null, args: [] };
        try {
                const firstPart = parts[0]!.toLowerCase();
                const arrayCommands = commandHandler.arrayCommands.get(firstPart);
                if (arrayCommands && arrayCommands.length > 0) {
                        for (const cmd of arrayCommands) {
                                const nameArr = cmd.name as string[];
                                const nameLength = nameArr.length;
                                if (parts.length < nameLength) continue;
                                let matches = true;
                                for (let j = 1; j < nameLength; j++) {
                                        if (parts[j]!.toLowerCase() !== nameArr[j]!.toLowerCase()) {
                                                matches = false;
                                                break;
                                        }
                                }
                                if (matches) return { command: cmd, args: parts.slice(nameLength) };
                        }
                }
                const aliasedName = commandHandler.aliases.get(firstPart);
                if (aliasedName) {
                        const command = commandHandler.commands.get(aliasedName);
                        if (command) return { command, args: parts.slice(1) };
                }
                const directCommand = commandHandler.commands.get(firstPart);
                if (directCommand) return { command: directCommand, args: parts.slice(1) };
                return { command: null, args: [] };
        } catch {
                return { command: null, args: [] };
        }
};

export default {
        name: 'messageCreate',
        async execute({ eventArgs, client }: EventExecuteContext): Promise<void> {
                if (!eventArgs?.[0]) return;

                const message = eventArgs[0] as Message;
                const bot = client;

                try {
                        if (!message || message.author?.bot || !message.guild || !message.content) return;

                        let isUserBlacklisted = false;
                        let isGuildBlacklisted = false;
                        let guildPrefixes: string[] = [];

                        try {
                                [isUserBlacklisted, isGuildBlacklisted, guildPrefixes] = await Promise.all([
                                        db.blacklist?.checkBlacklist(message.author.id).catch(() => false) ?? false,
                                        db.blacklist?.checkBlacklist(message.guild.id).catch(() => false) ?? false,
                                        db.guild?.getPrefixes(message.guild.id).catch(() => [config.prefix]) ?? [config.prefix],
                                ]);
                        } catch (error) {
                                logger.error('MessageCreate', `Database check failed: ${(error as Error).message}`);
                                return;
                        }

                        if (isUserBlacklisted || isGuildBlacklisted) return;

                        if (await handleMentionOnly(message, bot, guildPrefixes)) return;

                        const commandInfo = await parseCommand(message, bot, guildPrefixes);
                        if (!commandInfo) return;

                        const { command, args } = getCommand(commandInfo.parts, bot.commandHandler);
                        if (!command) return;

                        if (!canBotSendMessages(message.channel as TextBasedChannel)) {
                                return void (await sendDM(
                                        message.author,
                                        'Missing Bot Permissions',
                                        `I don't have permission to send messages in <#${message.channel.id}>. Please grant me the **Send Messages** and **View Channel** permissions in that channel.`,
                                        bot,
                                ));
                        }

                        const isIgnored = await db.guild
                                ?.isChannelIgnored(message.guild.id, message.channel.id)
                                .catch(() => false);

                        if (isIgnored) {
                                if (bot.commandHandler) {
                                        const ignoreNotifCooldown = await bot.commandHandler
                                                .isOnCooldown(
                                                        { name: 'ignoreNotif', cooldown: 30 } as Command,
                                                        message.author.id,
                                                        message.guild.id,
                                                )
                                                .catch(() => false);

                                        if (!ignoreNotifCooldown) {
                                                message
                                                        .reply(`${emoji.info} Commands disabled in this channel`)
                                                        .then((m: Message) => setTimeout(() => m.delete().catch(() => {}), 3e3))
                                                        .catch(() => {});

                                                await bot.commandHandler
                                                        .setCooldown(
                                                                { name: 'ignoreNotif', cooldown: 30 } as Command,
                                                                message.author.id,
                                                                message.guild.id,
                                                        )
                                                        .catch(() => {});
                                        }
                                }
                                return;
                        }

                        if (command.cooldown && bot.commandHandler && !config.ownerIds.includes(message.author.id)) {
                                try {
                                        const cooldown = await bot.commandHandler.isOnCooldown(
                                                command,
                                                message.author.id,
                                                message.guild.id,
                                        );
                                        if (cooldown) {
                                                const shouldNotify = await bot.commandHandler
                                                        .shouldNotifyAboutCooldown(command, message.author.id, message.guild.id)
                                                        .catch(() => true);

                                                if (shouldNotify) await sendCooldown(cooldown, message);
                                                return;
                                        }
                                        await bot.commandHandler.setCooldown(command, message.author.id, message.guild.id);
                                } catch (error) {
                                        logger.error('MessageCreate', `Cooldown check failed: ${(error as Error).message}`);
                                }
                        }

                        try {
                                const ctx = new CommandContext({ client: bot, message, args });
                                const permissionValidation = await validateCommand(ctx, command);
                                if (!permissionValidation.valid) {
                                        if (permissionValidation.cannotReply) {
                                                return void (await sendDM(
                                                        message.author,
                                                        permissionValidation.error?.title ?? 'Permission Error',
                                                        permissionValidation.error?.description ?? 'You cannot use this command.',
                                                        bot,
                                                ));
                                        }
                                        return void sendError(
                                                message,
                                                permissionValidation.error?.title ?? 'Permission Error',
                                                permissionValidation.error?.description ?? 'You cannot use this command.',
                                                bot,
                                        );
                                }
                                await command.execute({ ctx });
                        } catch (error) {
                                const displayName = Array.isArray(command.name)
                                        ? command.name.join(' ')
                                        : command.name;
                                logger.error(
                                        'MessageCreate',
                                        `Error executing ${displayName}: ${(error as Error).message}`,
                                        error,
                                );
                                void sendError(message, 'Command Error', 'An error occurred while executing the command.', bot);
                        }
                } catch (error) {
                        logger.error('MessageCreate', `Fatal error: ${(error as Error).message}`, error);
                }
        },
};
