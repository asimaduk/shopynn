import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import type { MerchantCommissionRow } from './MerchantApi';
import { COMMISSION_LIFECYCLE_COLOR, COMMISSION_LIFECYCLE_LABEL, formatDateShort } from './merchantFormatters';

export default function CommissionStatusChip({ commission }: { commission: MerchantCommissionRow }) {
	const lifecycle = commission.lifecycle ?? (commission.status === 'paid' ? 'paid' : 'payable');
	const tip =
		lifecycle === 'held' && commission.payable_after
			? `Payable from ${formatDateShort(commission.payable_after)}`
			: lifecycle === 'cancelled' && commission.cancel_reason
				? commission.cancel_reason
				: '';
	const chip = (
		<Chip
			size="small"
			label={COMMISSION_LIFECYCLE_LABEL[lifecycle]}
			color={COMMISSION_LIFECYCLE_COLOR[lifecycle]}
			variant={lifecycle === 'paid' ? 'filled' : 'outlined'}
		/>
	);
	return tip ? <Tooltip title={tip}>{chip}</Tooltip> : chip;
}
