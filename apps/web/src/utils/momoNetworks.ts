/** Public MoMo network logos (copied from easyown). Paths are under apps/web/public. */

export type MomoNetworkOption = {
	id: string;
	label: string;
	/** Paystack charge provider code */
	provider: 'mtn' | 'vod' | 'tgo';
	/** Payout profile network slug (if different) */
	payoutNetwork?: 'mtn' | 'vodafone' | 'airteltigo';
	iconSrc: string;
};

export const MOMO_NETWORK_OPTIONS: MomoNetworkOption[] = [
	{
		id: 'mtn',
		label: 'MTN',
		provider: 'mtn',
		payoutNetwork: 'mtn',
		iconSrc: '/assets/images/networks/mtnmomo.png'
	},
	{
		id: 'telecel',
		label: 'Telecel',
		provider: 'vod',
		payoutNetwork: 'vodafone',
		iconSrc: '/assets/images/networks/telecelcash.png'
	},
	{
		id: 'airteltigo',
		label: 'AirtelTigo',
		provider: 'tgo',
		payoutNetwork: 'airteltigo',
		iconSrc: '/assets/images/networks/atmoney.png'
	}
];

export function momoNetworkIconSrc(idOrProvider: string): string {
	const key = String(idOrProvider || '').toLowerCase();
	if (key === 'vod' || key === 'vodafone' || key === 'telecel') {
		return '/assets/images/networks/telecelcash.png';
	}
	if (key === 'tgo' || key === 'airteltigo' || key === 'at') {
		return '/assets/images/networks/atmoney.png';
	}
	return '/assets/images/networks/mtnmomo.png';
}
