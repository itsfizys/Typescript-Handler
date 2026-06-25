import util from 'util';
import { config as conf } from '#config';

const loggerConfig = {
        logLevel: 'debug',
        defaultContext: 'APP',
        timezone: 'Asia/Kolkata',
        colors: {
                info: '#2F6FD6',
                success: '#0FA37F',
                warning: '#C47A00',
                error: '#C2362B',
                debug: '#6B6B6B',
        },
        textColors: {
                message: '#D8DEE9',
                timestamp: '#7A7A7A',
                dimmed: '#4C4C4C',
                badge: '#E5E9F0',
        },
};

const rgb = (hex: string): ((t: string) => string) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return (t: string) => `\x1b[38;2;${r};${g};${b}m${t}\x1b[0m`;
};

const bg = (bgHex: string, fgHex: string): ((t: string) => string) => {
        const br = parseInt(bgHex.slice(1, 3), 16);
        const bgc = parseInt(bgHex.slice(3, 5), 16);
        const bb = parseInt(bgHex.slice(5, 7), 16);
        const fr = parseInt(fgHex.slice(1, 3), 16);
        const fg = parseInt(fgHex.slice(3, 5), 16);
        const fb = parseInt(fgHex.slice(5, 7), 16);
        return (t: string) => `\x1b[48;2;${br};${bgc};${bb}m\x1b[38;2;${fr};${fg};${fb}m ${t} \x1b[0m`;
};

const text = {
        message: rgb(loggerConfig.textColors.message),
        timestamp: rgb(loggerConfig.textColors.timestamp),
        dimmed: rgb(loggerConfig.textColors.dimmed),
};

interface ParsedLog {
        context: string;
        msg: string;
        error: Error | null;
}

class Logger {
        levels: Record<string, number>;
        consoleLogLevel: number;
        badges: Record<string, (t: string) => string>;

        constructor() {
                this.levels = { debug: 0, info: 1, success: 2, warn: 3, error: 4 };
                this.consoleLogLevel = this.levels[loggerConfig.logLevel] ?? 1;

                this.badges = {
                        info: bg(loggerConfig.colors.info, loggerConfig.textColors.badge),
                        success: bg(loggerConfig.colors.success, loggerConfig.textColors.badge),
                        warn: bg(loggerConfig.colors.warning, loggerConfig.textColors.badge),
                        error: bg(loggerConfig.colors.error, loggerConfig.textColors.badge),
                        debug: bg(loggerConfig.colors.debug, loggerConfig.textColors.badge),
                };
        }

        _time(): string {
                return new Date().toLocaleTimeString('en-IN', {
                        timeZone: loggerConfig.timezone,
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                });
        }

        _parse(args: unknown[]): ParsedLog {
                let context = loggerConfig.defaultContext;
                let error: Error | null = null;
                const a = [...args];

                if (a[a.length - 1] instanceof Error) error = a.pop() as Error;
                if (typeof a[0] === 'string') context = a.shift() as string;

                return { context, msg: a.length ? util.format(...a) : '', error };
        }

        _log(level: string, ...args: unknown[]): void {
                if (!conf.debug && level === 'debug') return;
                if ((this.levels[level] ?? 0) < this.consoleLogLevel) return;

                const { context, msg, error } = this._parse(args);

                const badge = this.badges[level];
                const line =
                        `${text.timestamp(this._time())} ` +
                        `${badge ? badge(context) : context} ` +
                        `${text.message(msg)}`;

                (level === 'error' || level === 'warn' ? console.warn : console.log)(line);

                if (error) {
                        const out = error.stack ?? error.message ?? util.inspect(error);
                        console.log(text.dimmed(out));
                }
        }

        info(...a: unknown[]): void {
                this._log('info', ...a);
        }
        success(...a: unknown[]): void {
                this._log('success', ...a);
        }
        warn(...a: unknown[]): void {
                this._log('warn', ...a);
        }
        error(...a: unknown[]): void {
                this._log('error', ...a);
        }
        debug(...a: unknown[]): void {
                this._log('debug', ...a);
        }
}

export const logger = new Logger();
