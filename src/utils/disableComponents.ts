import { logger } from '#utils';
import { ComponentType, ButtonStyle, MessageFlags, type Message } from 'discord.js';

interface ComponentJSON {
        type: number;
        components?: ComponentJSON[];
        accessory?: ComponentJSON;
        style?: number;
        disabled?: boolean;
}

interface ComponentLike {
        type: number;
        components?: ComponentLike[];
        accessory?: ComponentLike;
        toJSON(): ComponentJSON;
}

export async function disableComponents(msg: Message): Promise<void> {
        try {
                if (!msg?.components?.length) return;

                const disabled = (msg.components as unknown as ComponentLike[]).map((c) => {
                        const j = c.toJSON();

                        if (c.type === ComponentType.ActionRow) {
                                j.components = c.components?.map((s) => {
                                        const sj = s.toJSON();
                                        return sj.type === ComponentType.Button && sj.style === ButtonStyle.Link
                                                ? sj
                                                : { ...sj, disabled: true };
                                });
                        } else if ([ComponentType.Container, ComponentType.Section].includes(c.type)) {
                                j.components = _disableNested(c.components ?? []);

                                if (c.accessory?.type === ComponentType.Button) {
                                        const aj = c.accessory.toJSON();
                                        j.accessory = aj.style === ButtonStyle.Link ? aj : { ...aj, disabled: true };
                                }
                        }

                        return j;
                });

                await msg.edit({
                        components: disabled as never[],
                        flags: MessageFlags.IsComponentsV2,
                });
        } catch (err) {
                const code = (err as { code?: number }).code;
                if (![10008, 10003, 50001].includes(code ?? 0)) {
                        logger.error('Utils', 'disableComponents error', err);
                }
        }
}

export function _disableNested(comps: ComponentLike[]): ComponentJSON[] {
        return comps.map((c) => {
                const j = c.toJSON();

                if (c.type === ComponentType.ActionRow) {
                        j.components = c.components?.map((s) => {
                                const sj = s.toJSON();
                                return sj.type === ComponentType.Button && sj.style === ButtonStyle.Link
                                        ? sj
                                        : { ...sj, disabled: true };
                        });
                } else if ([ComponentType.Container, ComponentType.Section].includes(c.type)) {
                        j.components = _disableNested(c.components ?? []);

                        if (c.accessory?.type === ComponentType.Button) {
                                const aj = c.accessory.toJSON();
                                j.accessory = aj.style === ButtonStyle.Link ? aj : { ...aj, disabled: true };
                        }
                }

                return j;
        });
}
