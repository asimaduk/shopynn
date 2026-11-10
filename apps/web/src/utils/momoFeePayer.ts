export type MomoFeePayer = 'customer' | 'shop';

export function normalizeFeePayer(raw: unknown): MomoFeePayer {
	return String(raw || '').trim().toLowerCase() === 'shop' ? 'shop' : 'customer';
}

export function collectionCharge(faceAmount: number, percent: number, enabled: boolean, feePayer: MomoFeePayer) {
	const face = Math.round((Number(faceAmount) || 0) * 100) / 100;
	const pct = Number(percent) || 0;
	if (!enabled || face <= 0 || pct <= 0) {
		return { face, fee: 0, charge: face, settlement: face, feePayer };
	}
	const fee = Math.round(((face * pct) / 100) * 100) / 100;
	const shopPays = feePayer === 'shop';
	const charge = shopPays ? face : Math.round((face + fee) * 100) / 100;
	const net = Math.max(0, face - fee);
	const settlement = shopPays ? Math.round(net * 100) / 100 : face;
	return { face, fee, charge, settlement, feePayer };
}
