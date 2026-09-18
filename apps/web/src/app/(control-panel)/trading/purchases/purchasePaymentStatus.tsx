import Chip from '@mui/material/Chip';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';

export const PURCHASE_PAYMENT_STATUS = { UNPAID: 0, PAID: 1, PARTIAL: 2 } as const;

export type PurchasePaymentMeta = {
	label: string;
	/** MUI Chip color */
	color: 'success' | 'warning' | 'error';
	icon: string;
	/** Hex used for banners / accents */
	bannerBg: string;
	bannerLabel: (received?: boolean) => string;
};

export function getPurchasePaymentMeta(status?: number | string | null): PurchasePaymentMeta {
	const s = Number(status);
	if (s === PURCHASE_PAYMENT_STATUS.PAID) {
		return {
			label: 'Paid',
			color: 'success',
			icon: 'heroicons-outline:check-circle',
			bannerBg: '#16a34a',
			bannerLabel: (received) => (received ? 'Received · Paid' : 'Paid')
		};
	}
	if (s === PURCHASE_PAYMENT_STATUS.PARTIAL) {
		return {
			label: 'Partial',
			color: 'warning',
			icon: 'heroicons-outline:exclamation-circle',
			bannerBg: '#d97706',
			bannerLabel: (received) => (received ? 'Received · Partial' : 'Partial')
		};
	}
	return {
		label: 'Unpaid',
		color: 'error',
		icon: 'heroicons-outline:x-circle',
		bannerBg: '#dc2626',
		bannerLabel: (received) => (received ? 'Received · Unpaid' : 'Unpaid')
	};
}

type PurchasePaymentStatusChipProps = {
	status?: number | string | null;
	size?: 'small' | 'medium';
};

export function PurchasePaymentStatusChip({ status, size = 'small' }: PurchasePaymentStatusChipProps) {
	const meta = getPurchasePaymentMeta(status);
	return (
		<Chip
			size={size}
			color={meta.color}
			variant="filled"
			icon={<FuseSvgIcon size={16}>{meta.icon}</FuseSvgIcon>}
			label={meta.label}
			sx={{ fontWeight: 600 }}
		/>
	);
}
