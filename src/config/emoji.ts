import type { EmojiMap } from '../types/index.js';

export const emoji: EmojiMap = {
        check: '✅',
        cross: '❌',
        info: 'ℹ️',
        code: '💻',
        activity: '📊',
        settings: '⚙️',
        block: '🚫',
        arrow_left: '◀️',
        arrow_forward: '▶️',
        arrow_backward: '◀️',
        edit: '✏️',
        save: '💾',
        loading: '⏳',
        on: '🟢',
        off: '🔴',
        user: '👤',
        support: '🛠️',
        invite: '📨',
        star: '⭐',
        star_empty: '☆',
        feedback: '📝',
        warning: '⚠️',
        setup: '🔧',
        review: '❤️',
        date: '📅',
        heart: '❤️',
        fire: '🔥',
        sparkle: '✨',

        get(name: string, fallback = ''): string {
                return (this as unknown as Record<string, string>)[name] ?? fallback;
        },
};

export default emoji;
