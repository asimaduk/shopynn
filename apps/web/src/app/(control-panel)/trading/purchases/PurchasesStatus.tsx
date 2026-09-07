import _ from 'lodash';
import clsx from 'clsx';
import purchaseStatuses from './constants/purchaseStatuses';

/**
 * The purchases status properties.
 */
type PurchasesStatusProps = {
	name: string;
};

/**
 * The purchases status component.
 */
function PurchasesStatus(props: PurchasesStatusProps) {
	const { name } = props;

	return (
		<div
			className={clsx(
				'inline text-md font-semibold py-1 px-3 rounded-full truncate',
				_.find(purchaseStatuses, { id: name })?.color
			)}
		>
			{/* {name} */}
			{_.find(purchaseStatuses, { id: name })?.name}
		</div>
	);
}

export default PurchasesStatus;
