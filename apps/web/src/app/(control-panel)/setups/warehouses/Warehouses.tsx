'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import Alert from '@mui/material/Alert';
import { useMemo } from 'react';
import useUser from '@auth/useUser';
import WarehousesHeader from './WarehousesHeader';
import WarehousesTable from './WarehousesTable';
import { useGetWarehousesQuery, type Warehouse } from './WarehouseApi';

function hasPhone(w: Warehouse) {
	const p = w.phone;
	return p != null && String(p).trim().length > 0;
}

/**
 * The warehouses page.
 */
function Warehouses() {
	const { data: authUser } = useUser();
	const planUsage = authUser?.company?.plan_usage ?? authUser?.company?.subscription?.limits;
	const warehouseAddBlocked = Boolean(
		planUsage && planUsage.warehouseCount >= planUsage.maxWarehouses
	);

	const { data: warehouses = [], isLoading } = useGetWarehousesQuery(null, {
		refetchOnMountOrArgChange: true
	});

	const { warehouseCount, withPhoneCount } = useMemo(() => {
		const warehouseCount = warehouses.length;
		const withPhoneCount = warehouses.filter(hasPhone).length;
		return { warehouseCount, withPhoneCount };
	}, [warehouses]);

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
				{warehouseAddBlocked && planUsage ? (
					<Alert severity="warning" className="mt-4 shrink-0">
						You are using {planUsage.warehouseCount} of {planUsage.maxWarehouses} warehouses allowed on your{' '}
						{planUsage.tierDisplay ?? 'current'} plan. Remove a warehouse or upgrade to add more.
					</Alert>
				) : null}
				<WarehousesHeader
					warehouseCount={warehouseCount}
					withPhoneCount={withPhoneCount}
					isLoading={isLoading}
					addBlocked={warehouseAddBlocked}
				/>
				<WarehousesTable data={warehouses} isLoading={isLoading} />
			</div>
		</>
	);
}

export default Warehouses;
