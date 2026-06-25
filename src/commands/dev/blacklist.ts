import { Command } from '#command';
import { logger } from '#utils';
import { emoji } from '#emoji';
import { db } from '#dbManager';
import type { ExecuteContext } from '#command';
import type { CommandContext } from '#classes/context';

class BlacklistCommand extends Command {
        constructor() {
                super({
                        name: 'blacklist',
                        description: 'Manage user and guild blacklists',
                        usage: 'blacklist <add|remove|check|list> [id] [reason]',
                        aliases: ['bl'],
                        category: 'developer',
                        examples: [
                                'blacklist add 123456789 Spamming',
                                'bl remove 123456789',
                                'bl check 123456789',
                                'bl list',
                                'bl list user',
                                'bl list guild',
                        ],
                        ownerOnly: true,
                        enabledSlash: false,
                });
        }

        override async execute({ ctx }: ExecuteContext): Promise<void> {
                const action = ctx.args[0]?.toLowerCase();

                if (!action) {
                        await ctx.reply(`**Usage:** \`${this.usage}\``);
                        return;
                }

                switch (action) {
                        case 'add': await this.handleAdd(ctx); break;
                        case 'remove':
                        case 'rm': await this.handleRemove(ctx); break;
                        case 'check': await this.handleCheck(ctx); break;
                        case 'list': await this.handleList(ctx); break;
                        default: await ctx.reply('**Invalid action!** Use: add, remove, check, or list');
                }
        }

        async handleAdd(ctx: CommandContext): Promise<void> {
                const type = ctx.args[1]?.toLowerCase();
                const id = ctx.args[2];
                const reason = ctx.args.slice(3).join(' ') || 'No reason provided';

                if (!type || (type !== 'user' && type !== 'guild')) {
                        await ctx.reply('Provide type: user | guild');
                        return;
                }

                if (!id) {
                        await ctx.reply('Provide ID');
                        return;
                }

                if (await db.blacklist!.checkBlacklist(id)) {
                        await ctx.reply('Already blacklisted');
                        return;
                }

                try {
                        if (type === 'user') await db.blacklist!.blacklistUser(id, ctx.user.id, reason);
                        else await db.blacklist!.blacklistGuild(id, ctx.user.id, reason);
                        await ctx.reply(`Added ${type} ${id}`);
                } catch {
                        await ctx.reply('Failed');
                }
        }

        async handleRemove(ctx: CommandContext): Promise<void> {
                const id = ctx.args[1];

                if (!id) {
                        await ctx.reply('**Missing ID!** Provide a user or guild ID.');
                        return;
                }

                if (!(await db.blacklist!.checkBlacklist(id))) {
                        await ctx.reply('**Not Blacklisted!** This ID is not in the blacklist.');
                        return;
                }

                try {
                        await db.blacklist!.unblacklist(id);
                        await ctx.reply(`**Removed!** ID \`${id}\` has been removed from the blacklist.`);
                } catch (error) {
                        logger.error('Blacklist', `Failed to remove ${id} from blacklist`, error);
                        await ctx.reply('**Error!** Failed to remove from blacklist.');
                }
        }

        async handleCheck(ctx: CommandContext): Promise<void> {
                const id = ctx.args[1];

                if (!id) {
                        await ctx.reply('**Missing ID!** Provide a user or guild ID.');
                        return;
                }

                const entry = await db.blacklist!.getBlacklist(id);

                if (!entry) {
                        await ctx.reply(`**Not Blacklisted!** ID \`${id}\` is not in the blacklist.`);
                        return;
                }

                await ctx.reply(
                        `${emoji.info} **Blacklist Entry**\n` +
                                `**ID:** ${entry.id}\n` +
                                `**Type:** ${entry.type}\n` +
                                `**Reason:** ${entry.reason}\n` +
                                `**Blacklisted By:** <@${entry.blacklistedBy}>\n` +
                                `**Date:** <t:${Math.floor(new Date(entry.createdAt).getTime() / 1000)}:F>`,
                );
        }

        async handleList(ctx: CommandContext): Promise<void> {
                const rawType = ctx.args[1]?.toLowerCase();

                if (rawType && rawType !== 'user' && rawType !== 'guild') {
                        await ctx.reply('**Invalid type!** Use: user or guild');
                        return;
                }

                const type = rawType as 'user' | 'guild' | undefined;
                const entries = await db.blacklist!.getAllBlacklist(type);

                if (!entries || entries.length === 0) {
                        await ctx.reply(`**No Entries!** No ${type || 'blacklisted'} entries found.`);
                        return;
                }

                const typeFilter = type ? ` ${type}` : '';
                let response = `${emoji.info} **Blacklist${typeFilter} (${entries.length})**\n\n`;

                entries.slice(0, 10).forEach((entry) => {
                        response += `**${entry.type}** \`${entry.id}\` - ${entry.reason}\n`;
                });

                if (entries.length > 10) {
                        response += `\n*...and ${entries.length - 10} more*`;
                }

                await ctx.reply(response);
        }
}

export default new BlacklistCommand();
