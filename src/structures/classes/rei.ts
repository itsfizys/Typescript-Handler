export class Rei {
        $: Map<string, unknown>;
        max: number;

        constructor(max = 50000) {
                this.$ = new Map();
                this.max = max;
        }

        set(k: string, v: unknown): this {
                const m = this.$;
                if (m.size >= this.max && !m.has(k)) {
                        const first = m.keys().next().value as string | undefined;
                        if (first !== undefined) m.delete(first);
                }
                m.set(k, v);
                return this;
        }

        get(k: string): unknown {
                return this.$.get(k);
        }

        has(k: string): boolean {
                return this.$.has(k);
        }

        del(k: string): boolean {
                return this.$.delete(k);
        }

        delete(k: string): boolean {
                return this.$.delete(k);
        }

        clear(): this {
                this.$.clear();
                return this;
        }

        peek(k: string): unknown {
                return this.$.get(k);
        }

        mset(arr: [string, unknown][]): this {
                const len = arr.length;
                for (let i = 0; i < len; i++) {
                        this.set(arr[i][0]!, arr[i][1]);
                }
                return this;
        }

        setMany(arr: [string, unknown][]): this {
                return this.mset(arr);
        }

        mget(keys: string[]): unknown[] {
                const m = this.$;
                const len = keys.length;
                const out = new Array<unknown>(len);
                for (let i = 0; i < len; i++) {
                        out[i] = m.get(keys[i]!);
                }
                return out;
        }

        getMany(keys: string[]): unknown[] {
                return this.mget(keys);
        }

        mdel(keys: string[]): this {
                const m = this.$;
                const len = keys.length;
                for (let i = 0; i < len; i++) {
                        m.delete(keys[i]!);
                }
                return this;
        }

        deleteMany(keys: string[]): this {
                return this.mdel(keys);
        }

        exists(k: string): boolean {
                return this.$.has(k);
        }

        peekHas(k: string): boolean {
                return this.$.has(k);
        }

        getOr(k: string, d: unknown): unknown {
                const v = this.$.get(k);
                return v === undefined ? d : v;
        }

        setnx(k: string, v: unknown): 0 | 1 {
                if (!this.$.has(k)) {
                        this.set(k, v);
                        return 1;
                }
                return 0;
        }

        setNX(k: string, v: unknown): boolean {
                if (!this.$.has(k)) {
                        this.set(k, v);
                        return true;
                }
                return false;
        }

        incr(k: string, d = 1): number {
                const v = this.$.get(k);
                if (v === undefined) {
                        this.set(k, d);
                        return d;
                }
                const n = +(v as number) + d;
                this.set(k, n);
                return n;
        }

        incrby(k: string, d: number): number {
                return this.incr(k, d);
        }

        decr(k: string, d = 1): number {
                return this.incr(k, -d);
        }

        decrby(k: string, d: number): number {
                return this.incr(k, -d);
        }

        pop(k: string): unknown {
                const m = this.$;
                const v = m.get(k);
                if (v !== undefined) m.delete(k);
                return v;
        }

        keys(pattern?: string): string[] {
                const m = this.$;
                if (!pattern || pattern === '*') {
                        return Array.from(m.keys());
                }
                const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
                const regex = new RegExp(`^${escaped}$`);
                const matches: string[] = [];
                for (const k of m.keys()) {
                        if (regex.test(k)) matches.push(k);
                }
                return matches;
        }

        values(): unknown[] {
                return Array.from(this.$.values());
        }

        entries(): [string, unknown][] {
                return Array.from(this.$.entries());
        }

        hset(k: string, f: string, v: unknown): this {
                let h = this.$.get(k);
                if (!h || typeof h !== 'object' || Array.isArray(h) || h instanceof Set) {
                        h = {} as Record<string, unknown>;
                        this.set(k, h);
                }
                (h as Record<string, unknown>)[f] = v;
                return this;
        }

        hget(k: string, f: string): unknown {
                const h = this.$.get(k);
                return h && typeof h === 'object' && !Array.isArray(h) && !(h instanceof Set)
                        ? (h as Record<string, unknown>)[f]
                        : undefined;
        }

        hdel(k: string, f: string): boolean {
                const h = this.$.get(k);
                if (h && typeof h === 'object' && !Array.isArray(h) && !(h instanceof Set)) {
                        delete (h as Record<string, unknown>)[f];
                        return true;
                }
                return false;
        }

        hgetall(k: string): Record<string, unknown> {
                const h = this.$.get(k);
                return h && typeof h === 'object' && !Array.isArray(h) && !(h instanceof Set)
                        ? (h as Record<string, unknown>)
                        : {};
        }

        hmset(k: string, obj: Record<string, unknown>): this {
                let h = this.$.get(k);
                if (!h || typeof h !== 'object' || Array.isArray(h) || h instanceof Set) {
                        h = {} as Record<string, unknown>;
                        this.set(k, h);
                }
                Object.assign(h as Record<string, unknown>, obj);
                return this;
        }

        hmget(k: string, fields: string[]): unknown[] {
                const h = this.$.get(k);
                if (!h || typeof h !== 'object' || Array.isArray(h) || h instanceof Set) {
                        return fields.map(() => undefined);
                }
                const record = h as Record<string, unknown>;
                const len = fields.length;
                const out = new Array<unknown>(len);
                for (let i = 0; i < len; i++) {
                        out[i] = record[fields[i]!];
                }
                return out;
        }

        hincrby(k: string, f: string, d = 1): number {
                let h = this.$.get(k);
                if (!h || typeof h !== 'object' || Array.isArray(h) || h instanceof Set) {
                        h = {} as Record<string, unknown>;
                        this.set(k, h);
                }
                const record = h as Record<string, unknown>;
                const v = record[f];
                const n = (v === undefined ? 0 : (v as number) | 0) + d;
                record[f] = n;
                return n;
        }

        sadd(k: string, ...members: unknown[]): this {
                let s = this.$.get(k);
                if (!s || !(s instanceof Set)) {
                        s = new Set<unknown>();
                        this.set(k, s);
                }
                const set = s as Set<unknown>;
                const len = members.length;
                for (let i = 0; i < len; i++) {
                        set.add(members[i]);
                }
                return this;
        }

        smembers(k: string): unknown[] {
                const s = this.$.get(k);
                return s instanceof Set ? Array.from(s) : [];
        }

        sismember(k: string, m: unknown): boolean {
                const s = this.$.get(k);
                return s instanceof Set ? s.has(m) : false;
        }

        srem(k: string, ...members: unknown[]): this {
                const s = this.$.get(k);
                if (s instanceof Set) {
                        const set = s as Set<unknown>;
                        const len = members.length;
                        for (let i = 0; i < len; i++) {
                                set.delete(members[i]);
                        }
                }
                return this;
        }

        lpush(k: string, ...values: unknown[]): number {
                let arr = this.$.get(k);
                if (!Array.isArray(arr)) {
                        arr = [] as unknown[];
                        this.set(k, arr);
                }
                (arr as unknown[]).unshift(...values);
                return (arr as unknown[]).length;
        }

        rpush(k: string, ...values: unknown[]): number {
                let arr = this.$.get(k);
                if (!Array.isArray(arr)) {
                        arr = [] as unknown[];
                        this.set(k, arr);
                }
                (arr as unknown[]).push(...values);
                return (arr as unknown[]).length;
        }

        lpop(k: string): unknown {
                const arr = this.$.get(k);
                return Array.isArray(arr) ? (arr as unknown[]).shift() : undefined;
        }

        rpop(k: string): unknown {
                const arr = this.$.get(k);
                return Array.isArray(arr) ? (arr as unknown[]).pop() : undefined;
        }

        lrange(k: string, start: number, stop: number): unknown[] {
                const arr = this.$.get(k);
                if (!Array.isArray(arr)) return [];
                const end = stop === -1 ? arr.length : stop + 1;
                return (arr as unknown[]).slice(start, end);
        }

        llen(k: string): number {
                const arr = this.$.get(k);
                return Array.isArray(arr) ? arr.length : 0;
        }

        get size(): number {
                return this.$.size;
        }

        get length(): number {
                return this.$.size;
        }

        dbsize(): number {
                return this.$.size;
        }

        flushdb(): this {
                return this.clear();
        }

        flushall(): this {
                return this.clear();
        }
}

export class ReiT extends Rei {
        ttlMap: Map<string, number>;
        intervals: Map<string, ReturnType<typeof setTimeout>>;

        constructor(max = 5000) {
                super(max);
                this.ttlMap = new Map();
                this.intervals = new Map();
        }

        override set(k: string, v: unknown, ttl?: number): this {
                const existingTimeout = this.intervals.get(k);
                if (existingTimeout) {
                        clearTimeout(existingTimeout);
                        this.intervals.delete(k);
                        this.ttlMap.delete(k);
                }
                super.set(k, v);
                if (ttl) {
                        this.expire(k, ttl);
                }
                return this;
        }

        expire(k: string, seconds: number): this {
                const existing = this.intervals.get(k);
                if (existing) clearTimeout(existing);

                const timeout = setTimeout(() => {
                        this.$.delete(k);
                        this.ttlMap.delete(k);
                        this.intervals.delete(k);
                }, seconds * 1000);

                this.intervals.set(k, timeout);
                this.ttlMap.set(k, Date.now() + seconds * 1000);
                return this;
        }

        ttl(k: string): number {
                const expiry = this.ttlMap.get(k);
                if (!expiry) return -1;
                const remaining = Math.ceil((expiry - Date.now()) / 1000);
                return remaining > 0 ? remaining : -2;
        }

        override clear(): this {
                for (const timeout of this.intervals.values()) {
                        clearTimeout(timeout);
                }
                this.intervals.clear();
                this.ttlMap.clear();
                super.clear();
                return this;
        }

        override del(k: string): boolean {
                const timeout = this.intervals.get(k);
                if (timeout) {
                        clearTimeout(timeout);
                        this.intervals.delete(k);
                }
                this.ttlMap.delete(k);
                return super.del(k);
        }

        override delete(k: string): boolean {
                return this.del(k);
        }
}
