import type { PermissionResolvable, ApplicationCommandOptionData } from 'discord.js';

export interface SlashCommandData {
        name: string | string[];
        description: string;
        options?: ApplicationCommandOptionData[];
        defaultMemberPermissions?: PermissionResolvable;
}

export interface CommandOptions {
        name: string | string[];
        description?: string;
        usage?: string | string[];
        aliases?: string[];
        category?: string;
        cooldown?: number;
        examples?: string[];
        permissions?: PermissionResolvable[];
        userPermissions?: PermissionResolvable[];
        ownerOnly?: boolean;
        enabledSlash?: boolean;
        shouldNotDefer?: boolean;
        slashData?: SlashCommandData | null;
        maintenance?: boolean;
        voiceRequired?: boolean;
        sameVoiceChannel?: boolean;
}

export interface CacheConfig {
        type: 'redis' | 'memory';
        url?: string;
        fallback: 'redis' | 'memory';
        maxSize: number;
        flushOnStart: boolean;
        flushOnShutdown: boolean;
}

export interface DatabaseConfig {
        url: string;
        max_connections: number;
        connect_timeout: number;
        max_lifetime: number;
        logger: boolean;
}

export interface AppConfig {
        prefix: string;
        ownerIds: string[];
        colors: {
                bot: [number, number, number];
                error: [number, number, number];
                success: [number, number, number];
                warn: [number, number, number];
        };
        links: {
                supportServer: string;
                invite: string;
        };
        watermark: string;
        version: string;
        token: string;
        clientId: string;
        cache: CacheConfig;
        database: DatabaseConfig;
        debug: boolean;
        environment: string;
}

export interface ValidationResult {
        valid: boolean;
        error?: { title: string; description: string };
        cannotReply?: boolean;
}

export interface DiscordEvent {
        name: string;
        once?: boolean;
        execute(context: EventExecuteContext): Promise<void> | void;
}

export interface EventExecuteContext {
        eventArgs: unknown[];
        client: import('../structures/classes/client.js').Bot;
}

export interface EmojiMap {
        check: string;
        cross: string;
        info: string;
        code: string;
        activity: string;
        settings: string;
        block: string;
        arrow_left: string;
        arrow_forward: string;
        arrow_backward: string;
        edit: string;
        save: string;
        loading: string;
        on: string;
        off: string;
        user: string;
        support: string;
        invite: string;
        star: string;
        star_empty: string;
        feedback: string;
        warning: string;
        setup: string;
        review: string;
        date: string;
        heart: string;
        fire: string;
        sparkle: string;
        get(name: string, fallback?: string): string;
}
