import type { PermissionResolvable } from 'discord.js';
import type { CommandContext } from './context.js';
import type { CommandOptions, SlashCommandData } from '../../types/index.js';

export interface ExecuteContext {
        ctx: CommandContext;
}

export class Command {
        name: string | string[];
        description: string;
        usage: string | string[];
        aliases: string[];
        category: string;
        cooldown: number;
        examples: string[];
        permissions: PermissionResolvable[];
        userPermissions: PermissionResolvable[];
        ownerOnly: boolean;
        enabledSlash: boolean;
        shouldNotDefer: boolean;
        slashData: SlashCommandData | null;
        maintenance: boolean;
        voiceRequired: boolean;
        sameVoiceChannel: boolean;

        constructor(options: CommandOptions) {
                this.name = options.name;
                this.description = options.description ?? 'No description provided';
                this.usage = options.usage ?? options.name;
                this.aliases = options.aliases ?? [];
                this.category = options.category ?? 'Miscellaneous';
                this.cooldown = options.cooldown ?? 3;
                this.examples = options.examples ?? [];
                this.permissions = options.permissions ?? [];
                this.userPermissions = options.userPermissions ?? [];
                this.ownerOnly = options.ownerOnly ?? false;
                this.maintenance = options.maintenance ?? false;
                this.enabledSlash = options.enabledSlash ?? false;
                this.shouldNotDefer = options.shouldNotDefer ?? false;
                this.slashData = options.slashData ?? null;
                this.voiceRequired = options.voiceRequired ?? false;
                this.sameVoiceChannel = options.sameVoiceChannel ?? false;
        }

        async execute(_ctx: ExecuteContext): Promise<unknown> {
                throw new Error(`Command "${String(this.name)}" does not implement an execute method.`);
        }

        async autocomplete(_context: { interaction: unknown; client: unknown }): Promise<void> {}
}
