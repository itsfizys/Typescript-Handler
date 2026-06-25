import { Command } from '#command';
import {
        MessageFlags,
        ButtonStyle,
        ButtonBuilder,
        ActionRowBuilder,
        ContainerBuilder,
        TextDisplayBuilder,
        SeparatorBuilder,
        SeparatorSpacingSize,
} from 'discord.js';
import { emoji } from '#emoji';
import { config } from '#config';
import type { ExecuteContext } from '#command';

class InviteCommand extends Command {
        constructor() {
                super({
                        name: 'invite',
                        description: 'Get the bot invite link',
                        usage: 'invite',
                        aliases: ['inv', 'add'],
                        examples: ['invite'],
                        cooldown: 3,
                        enabledSlash: true,
                        slashData: {
                                name: 'invite',
                                description: 'Get the bot invite link',
                        },
                });
        }

        override async execute({ ctx }: ExecuteContext): Promise<void> {
                const name = ctx.client.user?.username ?? 'Bot';

                const container = new ContainerBuilder()
                        .setAccentColor([255, 255, 255])
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                        `${emoji.invite} **Invite ${name}**`,
                                ),
                        )
                        .addSeparatorComponents(
                                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                        )
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                        `> Click a button below to invite the bot to your server.`,
                                ),
                        )
                        .addActionRowComponents(
                                new ActionRowBuilder<ButtonBuilder>().addComponents(
                                        new ButtonBuilder()
                                                .setStyle(ButtonStyle.Link)
                                                .setLabel('Invite')
                                                .setURL(config.links.invite),
                                ),
                        );

                await ctx.reply({
                        components: [container],
                        flags: MessageFlags.IsComponentsV2,
                });
        }
}

export default new InviteCommand();
