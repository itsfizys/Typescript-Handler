import { Command } from '#command';
import {
        MessageFlags,
        ButtonStyle,
        ButtonBuilder,
        ContainerBuilder,
        TextDisplayBuilder,
        SeparatorBuilder,
        SeparatorSpacingSize,
        SectionBuilder,
} from 'discord.js';
import { emoji } from '#emoji';
import { config } from '#config';

class SupportCommand extends Command {
        constructor() {
                super({
                        name: ['support'],
                        description: 'Join support server',
                        aliases: ['help-server', 'discord', 'server'],
                        cooldown: 3,
                        enabledSlash: true,
                        slashData: {
                                name: 'support',
                                description: 'Join support server',
                        },
                });
        }

        async execute({ ctx }) {
                await ctx.reply({
                        components: [this._view()],
                        flags: MessageFlags.IsComponentsV2,
                });
        }

        private _view(): ContainerBuilder {
                const container = new ContainerBuilder();
                container.setAccentColor(config.colors.bot);

                container.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `${emoji.support} **Support Server**`,
                        ),
                );

                container.addSeparatorComponents(
                        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
                );

                container.addSectionComponents(
                        new SectionBuilder()
                                .addTextDisplayComponents(
                                        new TextDisplayBuilder().setContent(
                                                `> Join our support server for help, updates, and more.`,
                                        ),
                                )
                                .setButtonAccessory(
                                        new ButtonBuilder()
                                                .setStyle(ButtonStyle.Link)
                                                .setLabel('Join Server')
                                                .setURL(config.links.supportServer),
                                ),
                );

                return container;
        }
}

export default new SupportCommand();
