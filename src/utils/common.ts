export async function sleep(ms: number): Promise<void> {
        return new Promise((r) => setTimeout(r, ms));
}

const _segmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter !== 'undefined'
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        : null;

export function displayWidth(str: string): number {
        if (!_segmenter) return [...str].length;
        let n = 0;
        for (const _ of _segmenter.segment(str)) n++;
        return n;
}

export function padEndDisplay(str: string, width: number, fill = ' '): string {
        const w = displayWidth(str);
        return w >= width ? str : str + fill.repeat(width - w);
}
