import clsx from 'clsx';
import { formatGhsCurrency } from '../../dashboards/analytics/daily-sales/formatGhsCurrency';

type SalesStatusProps = {
	paymentStatus?: number | string | null;
	balanceDue?: number | string | null;
	totalAmount?: number | string | null;
	returnedAmount?: number | string | null;
};

const toNum = (v: unknown) => Number(String(v ?? 0).replace(/,/g, '')) || 0;

/** Whether goods on a sale were returned: all of it, part of it, or none. */
export function saleReturnState(totalAmount: unknown, returnedAmount: unknown): 'full' | 'partial' | null {
	const returned = toNum(returnedAmount);
	if (returned <= 0.02) return null;
	return returned >= toNum(totalAmount) - 0.02 ? 'full' : 'partial';
}

/** Payment state of a sale: 1 = paid, 2 = part-paid, 0 = on credit; returns override "Paid". */
function SalesStatus({ paymentStatus, balanceDue, totalAmount, returnedAmount }: SalesStatusProps) {
	const balance = toNum(balanceDue);
	const status = Number(paymentStatus);
	const owing = balance > 0.02;
	const returned = saleReturnState(totalAmount, returnedAmount);

	const { label, color } =
		returned === 'full'
			? { label: 'Refunded', color: 'bg-grey-500 text-white' }
			: owing && status === 2
				? { label: `Part-paid · ${formatGhsCurrency(balance, 2, 2)} owed`, color: 'bg-orange-500 text-white' }
				: owing && status !== 1
					? { label: `On credit · ${formatGhsCurrency(balance, 2, 2)} owed`, color: 'bg-red-500 text-white' }
					: returned === 'partial'
						? {
								label: `Paid · ${formatGhsCurrency(toNum(returnedAmount), 2, 2)} returned`,
								color: 'bg-teal-500 text-white'
							}
						: { label: 'Paid', color: 'bg-green-500 text-white' };

	return <div className={clsx('inline text-md font-semibold py-1 px-3 rounded-full truncate', color)}>{label}</div>;
}

export default SalesStatus;
