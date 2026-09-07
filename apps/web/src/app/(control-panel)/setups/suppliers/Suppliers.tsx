'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import { useMemo } from 'react';
import SuppliersHeader from './SuppliersHeader';
import SuppliersTable from './SuppliersTable';
import { useGetSuppliersQuery, type Supplier } from './SupplierApi';

function hasPhone(s: Supplier) {
	const p = s.phone;
	return p != null && String(p).trim().length > 0;
}

/**
 * The suppliers page.
 */
function Suppliers() {
	const { data: suppliers = [], isLoading } = useGetSuppliersQuery(null, {
		refetchOnMountOrArgChange: true
	});

	const { supplierCount, withPhoneCount } = useMemo(() => {
		const supplierCount = suppliers.length;
		const withPhoneCount = suppliers.filter(hasPhone).length;
		return { supplierCount, withPhoneCount };
	}, [suppliers]);

	return (
		<>
			<GlobalStyles
				styles={() => ({
					'#root': {
						maxHeight: '100vh'
					}
				})}
			/>
			<div className="w-full h-full flex flex-col px-4">
				<SuppliersHeader
					supplierCount={supplierCount}
					withPhoneCount={withPhoneCount}
					isLoading={isLoading}
				/>
				<SuppliersTable data={suppliers} isLoading={isLoading} />
			</div>
		</>
	);
}

export default Suppliers;
