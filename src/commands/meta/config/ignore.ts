import { Command } from '#command';
import {
        PermissionFlagsBits,
        MessageFlags,
        ButtonStyle,
        ActionRowBuilder,
        ButtonBuilder,
        ContainerBuilder,
        TextDisplayBuilder,
        SeparatorBuilder,
        SeparatorSpacingSize,
        ChannelSelectMenuBuilder,
        ChannelType,
        type MessageComponentInteraction,
        type GuildChannel,
        type GuildMember,
        type Message,
} from 'discord.js';
import { db } from '#dbManager';
import { emoji } from '#emoji';
import { config } from '#config';
import { disableComponents, logger } from '#utils';
import type { CommandContext } from '#classes/context';

const { colors } = config;

class IgnoreCommand extends Command {
        constructor() {
                super({
                        name: 'ignore',
                        description: 'Manage ignored channels',
                        usage: 'ignore',
                        aliases: ['ignored', 'ignorechannel'],
                        category: 'Configuration',
                        cooldown: 180,
                        examples: ['ignore', 'ignore add', 'ignore clear'],
                        userPermissions: [PermissionFlagsBits.ManageGuild],
                        permissions: [],
                        enabledSlash: true,
                        slashData: {
                                name: 'ignore',
                                description: 'Manage ignored channels',
                                defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
                        },
                });
        }

        async execute({ ctx }) {
                if (!ctx.guild) {
                        await ctx.reply('This command is only available in servers');
                        return;
                }

                const ignored = await db.guild!.getIgnoredChannels(ctx.guild.id);
                const container = this._renderIgnoreEditor(ctx, ignored);

                await ctx.reply({
                        components: [container],
                        flags: MessageFlags.IsComponentsV2,
                });

                const message = await ctx.fetchReply();
                if (message) this._startCollector(ctx, message);
        }

        private _renderIgnoreEditor(ctx: CommandContext, ignored: string[], feedback: string | null = null): ContainerBuilder {
                const container = new ContainerBuilder();
                container.setAccentColor(colors.bot);

                const preview =
                        ignored.length > 0
                                ? ignored.slice(0, 3).map((id) => `<#${id}>`).join(' • ') + (ignored.length > 3 ? ` +${ignored.length - 3} more` : '')
                                : 'No channels ignored';

                container.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent('## Ignored Channels'),
                );

                container.addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                );

                const feedbackText = feedback ? `\n\n${feedback}` : '';
                container.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `${preview}${feedbackText}\n\n-# ${ignored.length} of 25 channels`,
                        ),
                );

                container.addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
                );

                container.addActionRowComponents(
                        new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                                new ChannelSelectMenuBuilder()
                                        .setCustomId('ignore|select')
                                        .setPlaceholder('Select channels to ignore')
                                        .setChannelTypes([ChannelType.GuildText])
                                        .setMinValues(0)
                                        .setMaxValues(25)
                                        .setDefaultChannels(ignored),
                        ),
                );

                container.addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
                );

                container.addActionRowComponents(
                        new ActionRowBuilder<ButtonBuilder>().addComponents(
                                new ButtonBuilder()
                                        .setCustomId('ignore|current')
                                        .setLabel('Add Current')
                                        .setStyle(ButtonStyle.Primary)
                                        .setDisabled(ignored.length >= 25),
                                new ButtonBuilder()
                                        .setCustomId('ignore|category')
                                        .setLabel('Add Category')
                                        .setStyle(ButtonStyle.Primary)
                                        .setDisabled(ignored.length >= 25),
                                new ButtonBuilder()
                                        .setCustomId('ignore|clear')
                                        .setLabel('Clear All')
                                        .setStyle(ButtonStyle.Secondary)
                                        .setDisabled(ignored.length === 0),
                        ),
                );

                return container;
        }

        private _startCollector(ctx: CommandContext, message: Message): void {
                const collector = message.createMessageComponentCollector({
                        time: 300_000,
                        filter: (i: MessageComponentInteraction) => {
                                if (i.user.id !== ctx.author.id) {
                                        i.reply({
                                                content: `${emoji.cross} Not your command dude, Use ur own command`,
                                                flags: MessageFlags.Ephemeral,
                                        }).catch(() => {});
                                        return false;
                                }
                                return true;
                        },
                });

                collector.on('collect', async (interaction: MessageComponentInteraction) => {
                        try {
                                await this._handleAction(ctx, message, interaction);
                        } catch (error) {
                                logger.error('Ignore', 'Interaction error', error);
                        }
                });

                collector.on('end', async () => {
                        try {
                                await disableComponents(message);
                        } catch {}
                });
        }

        private _canViewChannel(channel: GuildChannel | null, botMember: GuildMember | null): boolean {
                if (!channel || !botMember) return false;
                return channel.permissionsFor(botMember).has(PermissionFlagsBits.ViewChannel);
        }

        private async _handleAction(ctx: CommandContext, msg: Message, i: MessageComponentInteraction): Promise<void> {
                const [action, param] = i.customId.split('|');
                const guild = ctx.guild!;
                const botMember = guild.members.me;

                if (action !== 'ignore') return;

                if (param === 'select') {
                        if (!i.isChannelSelectMenu()) return;
                        const validChannels = i.values.filter((channelId: string) => {
                                const channel = guild.channels.cache.get(channelId) as GuildChannel | undefined;
                                return channel ? this._canViewChannel(channel, botMember) : false;
                        });

                        const invalidCount = i.values.length - validChannels.length;

                        if (invalidCount > 0) {
                                await i.reply({
                                        content: `${emoji.cross} Cannot add ${invalidCount} channel${invalidCount > 1 ? 's' : ''} without view permission`,
                                        flags: MessageFlags.Ephemeral,
                                });
                        } else {
                                await i.deferUpdate();
                        }

                        await db.guild!.setIgnoredChannels(guild.id, validChannels);
                        const updated = await db.guild!.getIgnoredChannels(guild.id);

                        await msg.edit({ components: [this._renderIgnoreEditor(ctx, updated)] });
                } else if (param === 'current') {
                        await i.deferUpdate();
                        const current = await db.guild!.getIgnoredChannels(guild.id);
                        const channel = ctx.channel as GuildChannel | null;

                        if (!this._canViewChannel(channel, botMember)) {
                                await msg.edit({
                                        components: [this._renderIgnoreEditor(ctx, current, `${emoji.cross} Cannot ignore channel without view permission`)],
                                });
                                setTimeout(async () => {
                                        try {
                                                const updated = await db.guild!.getIgnoredChannels(guild.id);
                                                await msg.edit({ components: [this._renderIgnoreEditor(ctx, updated)] });
                                        } catch (e) { logger.error('Ignore', 'Clear feedback error', e); }
                                }, 2000);
                                return;
                        }

                        const channelId = ctx.channel?.id ?? '';
                        if (current.includes(channelId)) {
                                await msg.edit({
                                        components: [this._renderIgnoreEditor(ctx, current, `${emoji.cross} Channel already in list`)],
                                });
                                setTimeout(async () => {
                                        try {
                                                const updated = await db.guild!.getIgnoredChannels(guild.id);
                                                await msg.edit({ components: [this._renderIgnoreEditor(ctx, updated)] });
                                        } catch (e) { logger.error('Ignore', 'Clear feedback error', e); }
                                }, 2000);
                                return;
                        }

                        await db.guild!.setIgnoredChannels(guild.id, [...current, channelId]);
                        const updated = await db.guild!.getIgnoredChannels(guild.id);
                        await msg.edit({ components: [this._renderIgnoreEditor(ctx, updated, `${emoji.check} Current channel added`)] });

                        setTimeout(async () => {
                                try {
                                        const finalUpdated = await db.guild!.getIgnoredChannels(guild.id);
                                        await msg.edit({ components: [this._renderIgnoreEditor(ctx, finalUpdated)] });
                                } catch (e) { logger.error('Ignore', 'Clear feedback error', e); }
                        }, 2000);
                } else if (param === 'category') {
                        await i.deferUpdate();
                        const channelInGuild = guild.channels.cache.get(ctx.channel!.id) as GuildChannel | undefined;

                        if (!channelInGuild?.parentId) {
                                const current = await db.guild!.getIgnoredChannels(guild.id);
                                await msg.edit({
                                        components: [this._renderIgnoreEditor(ctx, current, `${emoji.cross} Channel not in a category`)],
                                });
                                setTimeout(async () => {
                                        try {
                                                const updated = await db.guild!.getIgnoredChannels(guild.id);
                                                await msg.edit({ components: [this._renderIgnoreEditor(ctx, updated)] });
                                        } catch (e) { logger.error('Ignore', 'Clear feedback error', e); }
                                }, 2000);
                                return;
                        }

                        const categoryChannels = guild.channels.cache
                                .filter(
                                        (c) =>
                                                (c as GuildChannel).parentId === channelInGuild.parentId &&
                                                c.type === ChannelType.GuildText &&
                                                this._canViewChannel(c as GuildChannel, botMember),
                                )
                                .map((c) => c.id);

                        const current = await db.guild!.getIgnoredChannels(guild.id);
                        const newChannels = categoryChannels.filter((id) => !current.includes(id));

                        if (newChannels.length === 0) {
                                await msg.edit({
                                        components: [this._renderIgnoreEditor(ctx, current, `${emoji.cross} No new channels to add from category`)],
                                });
                                setTimeout(async () => {
                                        try {
                                                const updated = await db.guild!.getIgnoredChannels(guild.id);
                                                await msg.edit({ components: [this._renderIgnoreEditor(ctx, updated)] });
                                        } catch (e) { logger.error('Ignore', 'Clear feedback error', e); }
                                }, 2000);
                                return;
                        }

                        await db.guild!.setIgnoredChannels(guild.id, [...current, ...newChannels]);

                        const parent = guild.channels.cache.get(channelInGuild.parentId);
                        const updated = await db.guild!.getIgnoredChannels(guild.id);
                        await msg.edit({
                                components: [this._renderIgnoreEditor(ctx, updated, `${emoji.check} Added ${newChannels.length} from ${parent?.name ?? 'category'}`)],
                        });

                        setTimeout(async () => {
                                try {
                                        const finalUpdated = await db.guild!.getIgnoredChannels(guild.id);
                                        await msg.edit({ components: [this._renderIgnoreEditor(ctx, finalUpdated)] });
                                } catch (e) { logger.error('Ignore', 'Clear feedback error', e); }
                        }, 2000);
                } else if (param === 'clear') {
                        await i.deferUpdate();
                        await db.guild!.setIgnoredChannels(guild.id, []);

                        const updated = await db.guild!.getIgnoredChannels(guild.id);
                        await msg.edit({ components: [this._renderIgnoreEditor(ctx, updated, `${emoji.check} All channels removed`)] });

                        setTimeout(async () => {
                                try {
                                        const finalUpdated = await db.guild!.getIgnoredChannels(guild.id);
                                        await msg.edit({ components: [this._renderIgnoreEditor(ctx, finalUpdated)] });
                                } catch (e) { logger.error('Ignore', 'Clear feedback error', e); }
                        }, 2000);
                }
        }
}

export default new IgnoreCommand();
