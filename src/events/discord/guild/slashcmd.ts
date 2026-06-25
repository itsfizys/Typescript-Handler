import {
        InteractionType,
        ContainerBuilder,
        TextDisplayBuilder,
        SeparatorBuilder,
        SeparatorSpacingSize,
        MessageFlags,
        type ChatInputCommandInteraction,
        type AutocompleteInteraction,
        type Interaction,
} from 'discord.js';
import { config } from '#config';
import { validateCommand, canBotSendMessages, logger } from '#utils';
import { CommandContext } from '#context';
import { db } from '#dbManager';
import { emoji } from '#emoji';
import type { Bot } from '#classes/client';
import type { Command } from '#classes/command';
import type { EventExecuteContext } from '../../../types/index.js';

const buildErrorContainer = (title: string, description: string): ContainerBuilder => {
        const container = new ContainerBuilder();
        container.setAccentColor(config.colors.error);
        container
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${emoji.cross} ${title}`))
                .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                )
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(description));
        return container;
};

const sendError = async (
        interaction: ChatInputCommandInteraction | AutocompleteInteraction,
        title: string,
        description: string,
        forceEphemeral = false,
): Promise<void> => {
        if (!interaction || !title || !description) return;
        if (interaction.type === InteractionType.ApplicationCommandAutocomplete) return;

        const chatInteraction = interaction as ChatInputCommandInteraction;
        try {
                const canSend = chatInteraction.channel ? canBotSendMessages(chatInteraction.channel) : false;
                const flags =
                        !canSend || forceEphemeral
                                ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                                : MessageFlags.IsComponentsV2;

                const reply = { components: [buildErrorContainer(title, description)], flags };

                if (chatInteraction.deferred || chatInteraction.replied) {
                        await chatInteraction.followUp(reply).catch(() => {});
                } else {
                        await chatInteraction.reply(reply).catch(() => {});
                }
        } catch (error) {
                logger.error('InteractionCreate', `Failed to send error: ${(error as Error).message}`);
        }
};

const sendCooldown = async (interaction: ChatInputCommandInteraction, cooldown: number): Promise<void> => {
        if (!interaction || !cooldown) return;

        try {
                const timestamp = Math.floor((Date.now() + cooldown) / 1000);
                const content = `**Cooldown** - Ends <t:${timestamp}:R>`;

                const cooldownContainer = new ContainerBuilder();
                cooldownContainer.setAccentColor(config.colors.warn);
                cooldownContainer.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(content),
                );
                await interaction
                        .reply({
                                components: [cooldownContainer],
                                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                        })
                        .catch(() => {});
        } catch (error) {
                logger.error('InteractionCreate', `Failed to send cooldown: ${(error as Error).message}`);
        }
};

const getCommandFile = (
        interaction: ChatInputCommandInteraction | AutocompleteInteraction,
        client: Bot,
): Command | null => {
        if (!interaction || !client?.commandHandler) return null;

        try {
                const { commandName } = interaction;
                const subCommandGroup = interaction.options.getSubcommandGroup(false);
                const subCommandName = interaction.options.getSubcommand(false);

                if (subCommandGroup && subCommandName) {
                        const cmd = client.commandHandler.slashCommandFiles.get(
                                `${commandName}:${subCommandGroup}:${subCommandName}`,
                        );
                        if (cmd) return cmd;
                }
                if (subCommandName) {
                        const cmd = client.commandHandler.slashCommandFiles.get(
                                `${commandName}:${subCommandName}`,
                        );
                        if (cmd) return cmd;
                }
                return client.commandHandler.slashCommandFiles.get(commandName) ?? null;
        } catch (error) {
                logger.error('InteractionCreate', `Error getting command file: ${(error as Error).message}`);
                return null;
        }
};

const handleChatInputCommand = async (interaction: ChatInputCommandInteraction, client: Bot): Promise<void> => {
        if (!interaction || !client) return;

        try {
                if (!interaction.inGuild()) {
                        return void sendError(interaction, 'Server Only', 'Commands can only be used in a server.', true);
                }

                if (!interaction.guild || !interaction.user || !interaction.channel) {
                        return void sendError(interaction, 'Invalid Context', 'Unable to process this interaction.', true);
                }

                if (!canBotSendMessages(interaction.channel)) {
                        return void sendError(
                                interaction,
                                'Missing Bot Permissions',
                                "I don't have permission to send messages in this channel. Please grant me the **Send Messages** and **View Channel** permissions before using commands.",
                                true,
                        );
                }

                const userId = interaction.user.id;
                const guildId = interaction.guild.id;
                const channelId = interaction.channel.id;

                let isUserBlacklisted = false;
                let isGuildBlacklisted = false;
                let isChannelIgnored = false;

                try {
                        [isUserBlacklisted, isGuildBlacklisted, isChannelIgnored] = await Promise.all([
                                db.blacklist?.checkBlacklist(userId).catch(() => false) ?? false,
                                db.blacklist?.checkBlacklist(guildId).catch(() => false) ?? false,
                                db.guild?.isChannelIgnored(guildId, channelId).catch(() => false) ?? false,
                        ]);
                } catch (error) {
                        logger.error('InteractionCreate', `Database check failed: ${(error as Error).message}`);
                }

                if (isUserBlacklisted || isGuildBlacklisted) {
                        return void interaction
                                .reply({ content: 'You or this server is blacklisted.', flags: MessageFlags.Ephemeral })
                                .catch(() => {});
                }

                if (isChannelIgnored) {
                        return void interaction
                                .reply({ content: '**Ignored Channel** Commands are disabled in this channel.', flags: MessageFlags.Ephemeral })
                                .catch(() => {});
                }

                const commandToExecute = getCommandFile(interaction, client);
                if (!commandToExecute) {
                        logger.warn('InteractionCreate', `No command file found for: /${interaction.commandName}`);
                        return void sendError(
                                interaction,
                                'Command Error',
                                'This command seems to be outdated or improperly configured.',
                                true,
                        );
                }

                if (commandToExecute.cooldown && client.commandHandler && !config.ownerIds.includes(userId)) {
                        try {
                                const cooldown = await client.commandHandler.isOnCooldown(commandToExecute, userId, guildId);
                                if (cooldown) {
                                        return void (await sendCooldown(interaction, cooldown));
                                }
                                await client.commandHandler.setCooldown(commandToExecute, userId, guildId);
                        } catch (error) {
                                logger.error('InteractionCreate', `Cooldown check failed: ${(error as Error).message}`);
                        }
                }

                try {
                        const ctx = new CommandContext({ client, interaction });
                        const permissionValidation = await validateCommand(ctx, commandToExecute);
                        if (!permissionValidation.valid) {
                                return void sendError(
                                        interaction,
                                        permissionValidation.error?.title ?? 'Permission Error',
                                        permissionValidation.error?.description ?? 'You cannot use this command.',
                                        true,
                                );
                        }
                        if (commandToExecute.shouldNotDefer) {
                                await commandToExecute.execute({ ctx });
                        } else {
                                await interaction.deferReply();
                                await commandToExecute.execute({ ctx });
                        }
                } catch (error) {
                        const cmdName = String(commandToExecute.slashData?.name ?? 'unknown');
                        logger.error('InteractionCreate', `Error executing: ${cmdName}`, error);
                        await sendError(interaction, 'Command Error', 'An unexpected error occurred while running the command.', true);
                }
        } catch (error) {
                logger.error('InteractionCreate', `Fatal error in command handler: ${(error as Error).message}`, error);
        }
};

const handleAutocomplete = async (interaction: AutocompleteInteraction, client: Bot): Promise<void> => {
        if (!interaction || !client) return;

        try {
                const commandToExecute = getCommandFile(interaction, client);
                if (!commandToExecute?.autocomplete) return;
                await commandToExecute.autocomplete({ interaction, client });
        } catch (error) {
                logger.error(
                        'InteractionCreate',
                        `Autocomplete error for '${interaction.commandName}': ${(error as Error).message}`,
                );
        }
};

export default {
        name: 'interactionCreate',
        async execute({ eventArgs, client }: EventExecuteContext): Promise<void> {
                if (!eventArgs?.[0]) return;

                const interaction = eventArgs[0] as Interaction;
                const bot = client;

                try {
                        if (interaction.type === InteractionType.ApplicationCommand) {
                                await handleChatInputCommand(interaction as ChatInputCommandInteraction, bot);
                        } else if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
                                await handleAutocomplete(interaction as AutocompleteInteraction, bot);
                        }
                } catch (error) {
                        logger.error('InteractionCreate', `Fatal error: ${(error as Error).message}`, error);
                }
        },
};
