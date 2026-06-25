import type {
        Message,
        ChatInputCommandInteraction,
        GuildMember,
        Guild,
        TextBasedChannel,
        TextChannel,
        User,
        InteractionReplyOptions,
        MessageReplyOptions,
        InteractionEditReplyOptions,
        MessageEditOptions,
} from 'discord.js';
import type { Bot } from './client.js';

interface CommandContextOptions {
        client: Bot;
        message?: Message | null;
        interaction?: ChatInputCommandInteraction | null;
        args?: string[];
}

type ReplyOptions = InteractionReplyOptions | MessageReplyOptions | string;
type EditOptions = InteractionEditReplyOptions | MessageEditOptions | string;

export class CommandContext {
        client: Bot;
        message: Message | null;
        interaction: ChatInputCommandInteraction | null;
        args: string[];
        isSlash: boolean;
        isPrefix: boolean;
        isInteraction: boolean;
        options: ChatInputCommandInteraction['options'] | null;
        _replyMessage: Message | null;
        _deferred: boolean;

        constructor({ client, message = null, interaction = null, args = [] }: CommandContextOptions) {
                this.client = client;
                this.message = message;
                this.interaction = interaction;
                this.args = args;
                this.isSlash = interaction !== null;
                this.isPrefix = message !== null;
                this.isInteraction = this.isSlash;
                this.options = this.isSlash ? interaction!.options : null;
                this._replyMessage = null;
                this._deferred = false;
        }

        get user(): User {
                return this.isSlash ? this.interaction!.user : this.message!.author;
        }

        get author(): User {
                return this.isSlash ? this.interaction!.user : this.message!.author;
        }

        get member(): GuildMember | null {
                if (this.isSlash) {
                        return this.interaction!.member as GuildMember | null;
                }
                return this.message!.member;
        }

        get guild(): Guild {
                return (this.isSlash ? this.interaction!.guild : this.message!.guild) as Guild;
        }

        get channel(): TextBasedChannel {
                return (this.isSlash ? this.interaction!.channel : this.message!.channel) as TextBasedChannel;
        }

        get commandName(): string {
                return this.isSlash
                        ? this.interaction!.commandName
                        : this.message!.content.split(/\s+/)[0] ?? '';
        }

        get replied(): boolean {
                return this.isSlash ? this.interaction!.replied : this._replyMessage !== null;
        }

        get deferred(): boolean {
                return this.isSlash ? this.interaction!.deferred : this._deferred;
        }

        inGuild(): boolean {
                return this.isSlash ? this.interaction!.inGuild() : this.message!.guild !== null;
        }

        async reply(options: ReplyOptions): Promise<Message> {
                const normalized = typeof options === 'string' ? { content: options } : options;
                if (this.isSlash) {
                        if (this.interaction!.deferred) {
                                return await this.interaction!.editReply(normalized as InteractionEditReplyOptions) as Message;
                        }
                        return await this.interaction!.reply(normalized as InteractionReplyOptions) as unknown as Message;
                }
                if (this._deferred && this._replyMessage) {
                        this._replyMessage = await this._replyMessage.edit(normalized as MessageEditOptions);
                        return this._replyMessage;
                }
                this._replyMessage = await this.message!.reply(normalized as MessageReplyOptions);
                return this._replyMessage;
        }

        async editReply(options: EditOptions): Promise<Message> {
                const normalized = typeof options === 'string' ? { content: options } : options;
                if (this.isSlash) {
                        return await this.interaction!.editReply(normalized as InteractionEditReplyOptions) as Message;
                }
                if (this._replyMessage) {
                        this._replyMessage = await this._replyMessage.edit(normalized as MessageEditOptions);
                        return this._replyMessage;
                }
                this._replyMessage = await this.message!.reply(normalized as MessageReplyOptions);
                return this._replyMessage;
        }

        async deferReply(options: { ephemeral?: boolean; fetchReply?: boolean } = {}): Promise<void> {
                if (this.isSlash) {
                        if (this.interaction!.deferred) return;
                        await this.interaction!.deferReply(options);
                        return;
                }
                this._deferred = true;
                await (this.message!.channel as TextChannel).sendTyping();
        }

        async followUp(options: ReplyOptions): Promise<Message> {
                const normalized = typeof options === 'string' ? { content: options } : options;
                if (this.isSlash) {
                        return await this.interaction!.followUp(normalized as InteractionReplyOptions) as unknown as Message;
                }
                return await (this.message!.channel as TextChannel).send(normalized as MessageReplyOptions);
        }

        async deleteReply(): Promise<void> {
                if (this.isSlash) {
                        await this.interaction!.deleteReply();
                        return;
                }
                if (this._replyMessage) {
                        await this._replyMessage.delete();
                }
        }

        async fetchReply(): Promise<Message | null> {
                if (this.isSlash) {
                        return await this.interaction!.fetchReply() as Message;
                }
                return this._replyMessage ?? null;
        }

        async sendTyping(): Promise<void> {
                if (this.isSlash) {
                        if (!this.deferred && !this.replied) {
                                await this.deferReply();
                        }
                        return;
                }
                await (this.message!.channel as TextChannel).sendTyping();
        }
}
