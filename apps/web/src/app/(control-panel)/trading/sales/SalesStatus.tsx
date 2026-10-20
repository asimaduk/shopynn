import clsx from 'clsx';
import { formatGhsCurrency } from '../../dashboards/analytics/daily-sales/formatGhsCurrency';

type SalesStatusProps = {
	paymentStatus?: number | string | null;
	balanceDue?: number | string | null;
};

/** Payment state of a sale: 1 = paid, 2 = part-paid, 0 = on credit. */
function SalesStatus({ paymentStatus, balanceDue }: SalesStatusProps) {
	const balance = Number(String(balanceDue ?? 0).replace(/,/g, '')) || 0;
	const status = Number(paymentStatus);
	const owing = balance > 0.02;

	const { label, color } =
		!owing || status === 1
			? { label: 'Paid', color: 'bg-green-500 text-white' }
			: status === 2
				? { label: `Part-paid · ${formatGhsCurrency(balance, 2, 2)} owed`, color: 'bg-orange-500 text-white' }
				: { label: `On credit · ${formatGhsCurrency(balance, 2, 2)} owed`, color: 'bg-red-500 text-white' };

	return <div className={clsx('inline text-md font-semibold py-1 px-3 rounded-full truncate', color)}>{label}</div>;
}

export default SalesStatus;
