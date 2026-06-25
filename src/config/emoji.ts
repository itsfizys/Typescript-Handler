import type { EmojiMap } from '../types/index.js';

export const emoji: EmojiMap = {
        // General / feedback system
        check: '<:fb_check:1495249387457351803>',
        cross: '<:fb_cross:1495249394671554711>',
        info: '<:fb_info:1495249412274913344>',
        code: '💻',
        activity: '📊',
        settings: '⚙️',
        block: '🚫',
        arrow_left: '◀️',
        arrow_forward: '<:single_arrow_forward:1495034204889813084>',
        arrow_backward: '<:single_arrow_backward:1495034264494936147>',
        edit: '<:fb_edit:1495249380381556850>',
        save: '💾',
        loading: '⏳',
        on: '🟢',
        off: '🔴',
        user: '<:fb_requester:1495249432407707790>',
        support: '<:support:1495027700757430385>',
        invite: '<:invite:1495030701303533720>',
        star: '<:fb_star:1495249372080898099>',
        star_empty: '<:fb_star:1495249372080898099>',
        feedback: '<:fb_edit:1495249380381556850>',
        warning: '<:fb_warning:1495249403492171988>',
        setup: '<:fb_fix:1495249419237589054>',
        review: '<:fb_love:1495249426288218174>',
        date: '<:fb_activity:1495249441496629340>',
        heart: '<:fb_heart:1495249456516300811>',
        fire: '<:fb_cutefire:1495249464536076348>',
        sparkle: '<:fb_sparkles:1495249471234375851>',

        get(name: string, fallback = ''): string {
                return (this as unknown as Record<string, string>)[name] ?? fallback;
        },
};

export default emoji;
