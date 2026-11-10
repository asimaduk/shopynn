export function normalizeFeePayer(raw) {
    return String(raw || '').trim().toLowerCase() === 'shop' ? 'shop' : 'customer';
}

export function collectionCharge(faceAmount, percent, enabled, feePayer) {
    const face = Math.round((Number(faceAmount) || 0) * 100) / 100;
    const pct = Number(percent) || 0;
    const payer = normalizeFeePayer(feePayer);
    if (!enabled || face <= 0 || pct <= 0) {
        return { face, fee: 0, charge: face, settlement: face, feePayer: payer };
    }
    const fee = Math.round(((face * pct) / 100) * 100) / 100;
    const shopPays = payer === 'shop';
    return {
        face,
        fee,
        charge: shopPays ? face : Math.round((face + fee) * 100) / 100,
        settlement: shopPays ? Math.round(Math.max(0, face - fee) * 100) / 100,
        feePayer: payer,
    };
}
