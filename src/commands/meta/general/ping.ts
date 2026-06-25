import { Command } from '#command';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';

const ESC = '\u001b';
const BOLD_MAGENTA = `${ESC}[1;35m`;
const BOLD_CYAN = `${ESC}[1;36m`;
const RESET = `${ESC}[0m`;

class PingCommand extends Command {
        constructor() {
                super({
                        name: ['ping'],
                        aliases: ['latency', 'ms', 'pong'],
                        cooldown: 3,
                        enabledSlash: true,
                        slashData: {
                                name: 'ping',
                                description: 'Ping',
                        },
                });
        }

        async execute({ ctx }) {
                const redisPing = await ctx.client.c.ping();
                const wsPing = Math.round(ctx.client.ws.ping);
                const avg = Math.round((wsPing + redisPing) / 2);

                const line = (label: string, ms: number) =>
                        `${BOLD_CYAN}${label.padEnd(17, ' ')}:: ${ms} MS${RESET}`;

                const ansi = [
                        '```ansi',
                        `${BOLD_MAGENTA}Pong!${RESET}`,
                        line('Websocket', wsPing),
                        line('Database', redisPing),
                        line('Average', avg),
                        '```',
                ].join('\n');

                const container = new ContainerBuilder()
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(ansi),
                        );

                await ctx.reply({
                        components: [container],
                        flags: MessageFlags.IsComponentsV2,
                });
        }
}

export default new PingCommand();
