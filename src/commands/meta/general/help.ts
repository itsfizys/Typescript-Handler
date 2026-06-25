import { Command } from '#command';
import {
        MessageFlags,
        ButtonStyle,
        ActionRowBuilder,
        ButtonBuilder,
        ContainerBuilder,
        TextDisplayBuilder,
        SeparatorBuilder,
        SeparatorSpacingSize,
        StringSelectMenuBuilder,
        StringSelectMenuOptionBuilder,
        type AutocompleteInteraction,
        type MessageComponentInteraction,
        type Message,
} from 'discord.js';
import { config } from '#config';
import { emoji } from '#emoji';
import { disableComponents, logger } from '#utils';
import type { Bot } from '#classes/client';
import type { Command as CommandType } from '#classes/command';
import type { CommandContext } from '#classes/context';

const { colors } = config;
const CMDS_PER_PAGE = 8;

class HelpCommand extends Command {
        constructor() {
                super({
                        name: 'help',
                        description: 'Browse commands or get info on a specific command',
                        usage: 'help [command]',
                        aliases: ['h', 'cmds', 'commands'],
                        cooldown: 3,
                        enabledSlash: true,
                        slashData: {
                                name: 'help',
                                description: 'Browse commands or get info on a specific command',
                                options: [
                                        {
                                                name: 'command',
                                                description: 'Get info about a specific command',
                                                type: 3,
                                                required: false,
                                                autocomplete: true,
                                        },
                                ],
                        },
                });
        }

        async execute({ ctx }) {
                const arg = ctx.isSlash
                        ? ctx.options?.getString('command')
                        : ctx.args.join(' ').trim();

                if (arg) {
                        const command = this._findCommand(ctx.client, arg);
                        const hidden = command?.category?.toLowerCase().includes('dev');
                        if (!command || hidden) {
                                const container = new ContainerBuilder();
                                container.setAccentColor(colors.error);
                                container.addTextDisplayComponents(
                                        new TextDisplayBuilder().setContent(
                                                `## ${emoji.cross} Command Not Found\n\nNo command named \`${arg}\` was found.`,
                                        ),
                                );
                                await ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
                                return;
                        }
                        const container = this._buildDetailsView(command, null, 0);
                        await ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
                        const message = await ctx.fetchReply();
                        if (message) this._startCollector(ctx, message);
                        return;
                }

                const categories = this._getCategories(ctx.client);
                const firstCat = Object.keys(categories).sort()[0] ?? null;
                const container = this._buildMainView(ctx.client, firstCat, 0);

                await ctx.reply({
                        components: [container],
                        flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications,
                });

                const message = await ctx.fetchReply();
                if (message) this._startCollector(ctx, message);
        }

        override async autocomplete({ interaction, client }: { interaction: unknown; client: unknown }): Promise<void> {
                const autocompleteInteraction = interaction as AutocompleteInteraction;
                const bot = client as Bot;
                try {
                        const focused = autocompleteInteraction.options.getFocused().toLowerCase();
                        const results: { name: string; value: string }[] = [];
                        const seen = new Set<string>();

                        for (const cmd of bot.commandHandler.commands.values()) {
                                if (cmd.category?.toLowerCase().includes('dev')) continue;
                                const key = this._cmdKey(cmd);
                                if (seen.has(key)) continue;
                                seen.add(key);
                                const display = this._cmdDisplay(cmd);
                                if (display.toLowerCase().includes(focused)) {
                                        results.push({ name: display, value: key });
                                }
                                if (results.length >= 25) break;
                        }

                        await autocompleteInteraction.respond(results);
                } catch (err) {
                        logger.error('Help', 'Autocomplete error', err);
                }
        }

        private _startCollector(ctx: CommandContext, message: Message): void {
                const collector = message.createMessageComponentCollector({
                        time: 600_000,
                        filter: (i: MessageComponentInteraction) => {
                                if (i.user.id !== ctx.author.id) {
                                        void i.reply({
                                                content: `${emoji.cross} This isn't your command.`,
                                                flags: MessageFlags.Ephemeral,
                                        }).catch(() => {});
                                        return false;
                                }
                                return true;
                        },
                });

                collector.on('collect', async (interaction: MessageComponentInteraction) => {
                        try {
                                await interaction.deferUpdate();
                                const [action, p1, p2] = interaction.customId.split('|');

                                if (action === 'hcat') {
                                        const container = this._buildMainView(ctx.client, p1 ?? null, 0);
                                        await message.edit({ components: [container] });
                                        return;
                                }

                                if (action === 'hpage') {
                                        const container = this._buildMainView(ctx.client, p1 ?? null, parseInt(p2 ?? '0'));
                                        await message.edit({ components: [container] });
                                        return;
                                }

                                if (action === 'hback') {
                                        const container = this._buildMainView(ctx.client, p1 ?? null, parseInt(p2 ?? '0'));
                                        await message.edit({ components: [container] });
                                        return;
                                }

                                if (interaction.isStringSelectMenu()) {
                                        if (action === 'hcatsel') {
                                                const cat = interaction.values[0] ?? null;
                                                const container = this._buildMainView(ctx.client, cat, 0);
                                                await message.edit({ components: [container] });
                                                return;
                                        }
                                        if (action === 'hcmdsel') {
                                                const parts = (interaction.values[0] ?? '').split('::');
                                                const [cmdKey, cat, page] = parts;
                                                const command = this._findCommand(ctx.client, cmdKey ?? '');
                                                if (!command) return;
                                                const container = this._buildDetailsView(command, cat ?? null, parseInt(page ?? '0'));
                                                await message.edit({ components: [container] });
                                        }
                                }
                        } catch (err) {
                                logger.error('Help', 'Interaction error', err);
                        }
                });

                collector.on('end', async () => {
                        try {
                                await disableComponents(message);
                        } catch {}
                });
        }

        private _buildMainView(client: Bot, selectedCat: string | null, page: number): ContainerBuilder {
                const categories = this._getCategories(client);
                const container = new ContainerBuilder();
                container.setAccentColor(colors.bot);

                const totalCmds = this._totalCmdCount(client);
                container.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `## Help\n-# ${totalCmds} commands across ${Object.keys(categories).length} categories`,
                        ),
                );

                container.addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                );

                const catNames = Object.keys(categories).sort();

                if (catNames.length === 0) {
                        container.addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`-# No categories found.`),
                        );
                } else {
                        const chunks: string[][] = [];
                        for (let i = 0; i < catNames.length; i += 25) {
                                chunks.push(catNames.slice(i, i + 25));
                        }

                        for (let ci = 0; ci < chunks.length; ci++) {
                                const chunk = chunks[ci]!;
                                const catOptions = chunk.map((name) =>
                                        new StringSelectMenuOptionBuilder()
                                                .setLabel(this._formatCatName(name))
                                                .setValue(name)
                                                .setDefault(name === selectedCat),
                                );

                                const placeholder = chunks.length > 1
                                        ? `Select a category (page ${ci + 1}/${chunks.length})`
                                        : 'Select a category';

                                container.addActionRowComponents(
                                        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                                                new StringSelectMenuBuilder()
                                                        .setCustomId(`hcatsel|${ci}|_`)
                                                        .setPlaceholder(placeholder)
                                                        .addOptions(catOptions),
                                        ),
                                );
                        }
                }

                if (selectedCat && categories[selectedCat]) {
                        container.addSeparatorComponents(
                                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                        );

                        const cmds = categories[selectedCat]!;
                        const totalPages = Math.ceil(cmds.length / CMDS_PER_PAGE);
                        const safePage = Math.max(0, Math.min(page, totalPages - 1));
                        const pageCmds = cmds.slice(
                                safePage * CMDS_PER_PAGE,
                                safePage * CMDS_PER_PAGE + CMDS_PER_PAGE,
                        );

                        const noDesc = 'No description';
                        const listText = pageCmds
                                .map(
                                        (cmd) =>
                                                `* **${this._cmdDisplay(cmd)}** — ${this._trunc(cmd.description || noDesc, 55)}`,
                                )
                                .join('\n');

                        container.addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                        `${listText}\n\n-# ${this._formatCatName(selectedCat)} • Page ${safePage + 1}/${totalPages} • ${cmds.length} commands`,
                                ),
                        );

                        const cmdOptions = pageCmds.map((cmd) => {
                                const key = this._cmdKey(cmd);
                                return new StringSelectMenuOptionBuilder()
                                        .setLabel(this._trunc(this._cmdDisplay(cmd), 100))
                                        .setValue(`${key}::${selectedCat}::${safePage}`)
                                        .setDescription(this._trunc(cmd.description || noDesc, 100));
                        });

                        container.addActionRowComponents(
                                new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                                        new StringSelectMenuBuilder()
                                                .setCustomId('hcmdsel|_|_')
                                                .setPlaceholder('Select a command')
                                                .addOptions(cmdOptions),
                                ),
                        );

                        if (totalPages > 1) {
                                container.addActionRowComponents(
                                        new ActionRowBuilder<ButtonBuilder>().addComponents(
                                                new ButtonBuilder()
                                                        .setCustomId(`hpage|${selectedCat}|${safePage - 1}`)
                                                        .setStyle(ButtonStyle.Secondary)
                                                        .setEmoji('◀️')
                                                        .setDisabled(safePage === 0),
                                                new ButtonBuilder()
                                                        .setCustomId(`hpage|${selectedCat}|${safePage + 1}`)
                                                        .setStyle(ButtonStyle.Secondary)
                                                        .setEmoji('▶️')
                                                        .setDisabled(safePage === totalPages - 1),
                                        ),
                                );
                        }
                }

                return container;
        }

        private _buildDetailsView(command: CommandType, fromCat: string | null, fromPage: number): ContainerBuilder {
                const container = new ContainerBuilder();
                container.setAccentColor(colors.bot);

                const display = this._cmdDisplay(command);
                container.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`## ${display}`),
                );

                container.addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                );

                const lines: string[] = [];
                lines.push(command.description || 'No description');

                if (command.usage) lines.push(`* **Usage:** \`${command.usage}\``);
                if (command.cooldown) lines.push(`* **Cooldown:** ${command.cooldown}s`);
                if (command.aliases?.length)
                        lines.push(`* **Aliases:** ${command.aliases.map((a) => `\`${a}\``).join(', ')}`);
                if (command.examples?.length)
                        lines.push(`* **Examples:** ${command.examples.map((e) => `\`${e}\``).join(', ')}`);
                if (command.userPermissions?.length)
                        lines.push(`* **User Permissions:** ${command.userPermissions.map((p) => this._formatPerm(p)).join(', ')}`);
                if (command.permissions?.length)
                        lines.push(`* **Bot Permissions:** ${command.permissions.map((p) => this._formatPerm(p)).join(', ')}`);
                if (command.enabledSlash && command.slashData) {
                        const slashName = Array.isArray(command.slashData.name)
                                ? `/${command.slashData.name.join(' ')}`
                                : `/${command.slashData.name}`;
                        lines.push(`* **Slash:** \`${slashName}\``);
                }

                container.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(lines.join('\n')),
                );

                if (fromCat) {
                        container.addSeparatorComponents(
                                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                        );
                        container.addActionRowComponents(
                                new ActionRowBuilder<ButtonBuilder>().addComponents(
                                        new ButtonBuilder()
                                                .setCustomId(`hback|${fromCat}|${fromPage}`)
                                                .setLabel('Back')
                                                .setStyle(ButtonStyle.Secondary)
                                                .setEmoji('◀️'),
                                ),
                        );
                }

                return container;
        }

        private _getCategories(client: Bot): Record<string, CommandType[]> {
                const categories: Record<string, CommandType[]> = {};

                for (const [catName, cmds] of client.commandHandler.categories.entries()) {
                        if (catName.toLowerCase().includes('dev')) continue;
                        const top = catName.split('/')[0] ?? catName;
                        if (!categories[top]) categories[top] = [];
                        for (const cmd of cmds) {
                                if (!cmd.category?.toLowerCase().includes('dev')) {
                                        categories[top]!.push(cmd);
                                }
                        }
                }

                for (const key in categories) {
                        if (categories[key]!.length === 0) delete categories[key];
                }

                return categories;
        }

        private _totalCmdCount(client: Bot): number {
                return Array.from(client.commandHandler.commands.values()).filter(
                        (cmd) => !cmd.category?.toLowerCase().includes('dev'),
                ).length;
        }

        private _findCommand(client: Bot, key: string): CommandType | null {
                if (!key) return null;
                const normalized = key.toLowerCase().trim();
                const colonKey = normalized.replace(/\s+/g, ':');

                let cmd = client.commandHandler.commands.get(colonKey);
                if (cmd) return cmd;

                cmd = client.commandHandler.commands.get(normalized);
                if (cmd) return cmd;

                const aliasTarget = client.commandHandler.aliases.get(normalized);
                if (aliasTarget) {
                        cmd = client.commandHandler.commands.get(aliasTarget);
                        const hidden = cmd?.category?.toLowerCase().includes('dev');
                        if (cmd && !hidden) return cmd;
                }

                for (const c of client.commandHandler.commands.values()) {
                        if (Array.isArray(c.name)) {
                                if (
                                        c.name.join(':').toLowerCase() === colonKey ||
                                        c.name.join(' ').toLowerCase() === normalized
                                )
                                        return c;
                        }
                }

                return null;
        }

        private _cmdKey(cmd: CommandType): string {
                return Array.isArray(cmd.name)
                        ? cmd.name.join(':').toLowerCase()
                        : cmd.name.toLowerCase();
        }

        private _cmdDisplay(cmd: CommandType): string {
                return Array.isArray(cmd.name) ? cmd.name.join(' ') : cmd.name;
        }

        private _formatCatName(name: string): string {
                return name
                        .split(/[-_/]/)
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(' ');
        }

        private _formatPerm(perm: unknown): string {
                const map: Record<string, string> = {
                        '1': 'Create Invites', '2': 'Kick Members', '4': 'Ban Members',
                        '8': 'Administrator', '16': 'Manage Channels', '32': 'Manage Guild',
                        '64': 'Add Reactions', '128': 'View Audit Log', '1024': 'View Channel',
                        '2048': 'Send Messages', '8192': 'Manage Messages', '268435456': 'Manage Roles',
                        '1099511627776': 'Moderate Members',
                };

                if (typeof perm === 'bigint') return map[perm.toString()] ?? `Unknown (${perm}n)`;
                if (typeof perm === 'string') return perm.replace(/([A-Z])/g, ' $1').trim();
                return String(perm);
        }

        private _trunc(text: string, max: number): string {
                if (!text || text.length <= max) return text ?? '';
                return text.slice(0, max - 3) + '...';
        }
}

export default new HelpCommand();
