import {
        PermissionFlagsBits,
        type GuildMember,
        type Guild,
        type TextBasedChannel,
        type VoiceBasedChannel,
} from 'discord.js';
import { config } from '#config/config';
import type { Command } from '#classes/command';
import type { CommandContext } from '#classes/context';
import type { ValidationResult } from '../types/index.js';

const ownerSet = new Set(config.ownerIds);

const permissionNames = new Map<bigint, string>();

for (const [name, value] of Object.entries(PermissionFlagsBits)) {
        if (permissionNames.get(value)) continue;
        permissionNames.set(
                value,
                name
                        .split(/(?=[A-Z])/)
                        .join(' ')
                        .replace(/^./, (str) => str.toUpperCase()),
        );
}

export const isOwner = (userId: string): boolean => ownerSet.has(userId);

export const canUseCommand = (member: GuildMember, command: Command): boolean => {
        if (!member.permissions) return false;
        if (command.ownerOnly && !ownerSet.has(member.id)) return false;
        if (!command.userPermissions?.length) return true;

        const perms = member.permissions;
        for (const perm of command.userPermissions) {
                if (!perms.has(perm)) return false;
        }
        return true;
};

type GuildTextChannel = TextBasedChannel & { guild: Guild };

const isGuildChannel = (channel: TextBasedChannel): channel is GuildTextChannel => {
        return 'guild' in channel && channel.guild !== null;
};

export const getMissingBotPermissions = (channel: TextBasedChannel | null, permissions: bigint[]): string[] => {
        if (!channel || !isGuildChannel(channel) || !channel.guild.members.me || !permissions.length) {
                return permissions.map((p) => permissionNames.get(p) ?? 'Unknown Permission');
        }

        try {
                const botPerms = channel.guild.members.me.permissionsIn(channel.id);
                const missing: string[] = [];
                for (const perm of permissions) {
                        if (!botPerms.has(perm)) {
                                missing.push(permissionNames.get(perm) ?? 'Unknown Permission');
                        }
                }
                return missing;
        } catch {
                return permissions.map((p) => permissionNames.get(p) ?? 'Unknown Permission');
        }
};

export const canBotSendMessages = (channel: TextBasedChannel | null): boolean => {
        if (!channel || !isGuildChannel(channel) || !channel.guild.members.me) return false;

        try {
                const botPerms = channel.guild.members.me.permissionsIn(channel.id);
                return (
                        botPerms.has(PermissionFlagsBits.SendMessages) &&
                        botPerms.has(PermissionFlagsBits.ViewChannel)
                );
        } catch {
                return false;
        }
};

export const getVoiceChannelMissingPermissions = (voiceChannel: VoiceBasedChannel | null): string[] => {
        if (!voiceChannel?.guild?.members?.me) {
                return ['View Channel', 'Connect', 'Speak'];
        }

        try {
                const botPerms = voiceChannel.guild.members.me.permissionsIn(voiceChannel);
                const missing: string[] = [];
                if (!botPerms.has(PermissionFlagsBits.ViewChannel)) missing.push('View Channel');
                if (!botPerms.has(PermissionFlagsBits.Connect)) missing.push('Connect');
                if (!botPerms.has(PermissionFlagsBits.Speak)) missing.push('Speak');
                return missing;
        } catch {
                return ['View Channel', 'Connect', 'Speak'];
        }
};

export const getUserPermissionsList = (userPermissions: bigint[]): string | null =>
        userPermissions?.length
                ? userPermissions
                                .map((p) => permissionNames.get(p) ?? 'Unknown Permission')
                                .join(', ')
                : null;

export const validateCommand = async (ctx: CommandContext, command: Command): Promise<ValidationResult> => {
        if (!ctx || !command) {
                return {
                        valid: false,
                        error: { title: 'Invalid Request', description: 'Command context is invalid.' },
                };
        }

        const user = ctx.user;
        const channel = ctx.channel;
        const guild = ctx.guild;

        if (!user || !channel || !guild) {
                return {
                        valid: false,
                        error: { title: 'Context Error', description: 'Unable to process command context.' },
                };
        }

        if (!canBotSendMessages(channel)) {
                return {
                        valid: false,
                        error: {
                                title: 'Missing Bot Permissions',
                                description:
                                        "I don't have permission to send messages in this channel. Please grant me the **Send Messages** and **View Channel** permissions.",
                        },
                        cannotReply: true,
                };
        }

        let member: GuildMember;
        try {
                member = await guild.members.fetch(user.id);
        } catch {
                return {
                        valid: false,
                        error: { title: 'Member Not Found', description: 'Could not fetch your member data.' },
                };
        }

        if (command.maintenance && !ownerSet.has(user.id)) {
                return {
                        valid: false,
                        error: {
                                title: 'Command Under Maintenance',
                                description: 'This command is temporarily unavailable. Please try again later.',
                        },
                };
        }

        if (command.ownerOnly && !ownerSet.has(user.id)) {
                return {
                        valid: false,
                        error: { title: 'Permission Denied', description: 'This is an owner-only command.' },
                };
        }

        if (!canUseCommand(member, command)) {
                const requiredPerms = getUserPermissionsList(command.userPermissions as bigint[]);
                return {
                        valid: false,
                        error: {
                                title: 'Insufficient Permissions',
                                description: requiredPerms
                                        ? `You do not have the required permissions to use this command. You need: \`${requiredPerms}\``
                                        : 'You do not have the required permissions to use this command.',
                        },
                };
        }

        if (command.permissions.length) {
                const missingBotPerms = getMissingBotPermissions(channel, command.permissions as bigint[]);
                if (missingBotPerms.length) {
                        return {
                                valid: false,
                                error: {
                                        title: 'Missing Bot Permissions',
                                        description: `I need the following permissions to run this command: \`${missingBotPerms.join(', ')}\``,
                                },
                        };
                }
        }

        if (command.voiceRequired && !member.voice.channel) {
                return {
                        valid: false,
                        error: {
                                title: 'Voice Channel Required',
                                description: 'You must be in a voice channel to use this command.',
                        },
                };
        }

        if (command.voiceRequired && member.voice.channel) {
                const voiceMissing = getVoiceChannelMissingPermissions(member.voice.channel);
                if (voiceMissing.length > 0) {
                        return {
                                valid: false,
                                error: {
                                        title: 'Voice Channel Permissions',
                                        description: `I need the following permissions in your voice channel: \`${voiceMissing.join(', ')}\``,
                                },
                        };
                }
        }

        if (command.sameVoiceChannel && !inSameVoiceChannel(member, guild)) {
                return {
                        valid: false,
                        error: {
                                title: 'Same Voice Channel Required',
                                description: 'You must be in the same voice channel as the bot to use this command.',
                        },
                };
        }

        return { valid: true };
};

export const inSameVoiceChannel = (member: GuildMember, guild: Guild): boolean => {
        if (!guild.members.me) return false;
        if (!member.voice) return false;

        try {
                const botChannel = guild.members.me.voice.channel;
                const memberChannel = member.voice.channel;

                if (!botChannel) return memberChannel !== null;
                if (!memberChannel) return false;

                return member.voice.channelId === guild.members.me.voice.channelId;
        } catch {
                return false;
        }
};
