/**
 * Rules-first parser: cashier speech -> [{ item: string, qty: number }].
 * No product IDs — matching happens in voicePosCatalog.
 */

const NUMBER_WORDS = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    dozen: 12,
    pair: 2,
    couple: 2,
    few: 3,
};

function parseLeadingQuantity(segment) {
    let s = String(segment || '').trim().toLowerCase();
    if (!s) return { qty: 1, rest: '' };

    s = s.replace(/^(please\s+|can\s+i\s+get\s+|give\s+me\s+|i\s+need\s+|add\s+|get\s+|put\s+)/i, '').trim();

    // "a " / "an "
    const aAn = s.match(/^(a|an)\s+(.+)/i);
    if (aAn) {
        return { qty: 1, rest: aAn[2].trim() };
    }

    // digits optional x: "3 x foo", "3x foo", "3 foo"
    const numDigit = s.match(/^(\d+)\s*(?:x\s*|\s+)\s*(.+)$/i);
    if (numDigit) {
        const n = parseInt(numDigit[1], 10);
        if (Number.isFinite(n) && n > 0) return { qty: Math.min(n, 9999), rest: numDigit[2].trim() };
    }
    const numDigitOnly = s.match(/^(\d+)\s*$/);
    if (numDigitOnly) {
        const n = parseInt(numDigitOnly[1], 10);
        if (Number.isFinite(n) && n > 0) return { qty: Math.min(n, 9999), rest: '' };
    }

    // word numbers at start
    const tokens = s.split(/\s+/);
    if (tokens.length >= 2) {
        const w = tokens[0].replace(/[^a-z]/gi, '').toLowerCase();
        if (NUMBER_WORDS[w] != null && NUMBER_WORDS[w] > 0) {
            return { qty: Math.min(NUMBER_WORDS[w], 9999), rest: tokens.slice(1).join(' ').trim() };
        }
    }

    return { qty: 1, rest: s };
}

function splitSegments(text) {
    const t = String(text || '')
        .trim()
        .replace(/\s+/g, ' ');
    if (!t) return [];
    const parts = t.split(/\s+(?:and|plus|with)\s+|\s*,\s*|\s*;\s*|\s*&\s*/i);
    return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * @param {string} transcript
 * @returns {{ item: string, qty: number }[]}
 */
export function parseVoiceOrderTranscript(transcript) {
    const segments = splitSegments(transcript);
    const out = [];
    for (const seg of segments) {
        const { qty, rest } = parseLeadingQuantity(seg);
        const item = rest || seg.replace(/^\d+\s*/, '').trim();
        if (!item) continue;
        out.push({ item, qty: qty > 0 ? qty : 1 });
    }
    return out;
}
