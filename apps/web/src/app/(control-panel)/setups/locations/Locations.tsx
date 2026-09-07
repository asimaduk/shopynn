'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import Alert from '@mui/material/Alert';
import { useMemo } from 'react';
import useUser from '@auth/useUser';
import LocationsHeader from './LocationsHeader';
import LocationsTable from './LocationsTable';
import { useGetLocationsQuery, type Location } from './LocationApi';

function warehousesCountForLocation(row: Location) {
	const r = row as Location & { warehouses_count?: number; warehousesCount?: number };
	const n = Number(r.warehouses_count ?? r.warehousesCount ?? 0);
	return Number.isFinite(n) ? n : 0;
}

/**
 * The locations page.
 */
function Locations() {
	const { data: authUser } = useUser();
	const planUsage = authUser?.company?.plan_usage ?? authUser?.company?.subscription?.limits;
	const locationAddBlocked = Boolean(
		planUsage && planUsage.locationCount >= planUsage.maxLocations
	);

	const { data: locations = [], isLoading } = useGetLocationsQuery(null, {
		refetchOnMountOrArgChange: true
	});

	const { locationCount, withWarehouseCount } = useMemo(() => {
		const locationCount = locations.length;
		const withWarehouseCount = locations.filter((l) => warehousesCountForLocation(l) > 0).length;
		return { locationCount, withWarehouseCount };
	}, [locations]);

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
				{locationAddBlocked && planUsage ? (
					<Alert severity="warning" className="mt-4 shrink-0">
						You are using {planUsage.locationCount} of {planUsage.maxLocations} locations allowed on your{' '}
						{planUsage.tierDisplay ?? 'current'} plan. Remove a location or upgrade to add more.
					</Alert>
				) : null}
				<LocationsHeader
					locationCount={locationCount}
					withWarehouseCount={withWarehouseCount}
					isLoading={isLoading}
					addBlocked={locationAddBlocked}
				/>
				<LocationsTable data={locations} isLoading={isLoading} />
			</div>
		</>
	);
}

export default Locations;
