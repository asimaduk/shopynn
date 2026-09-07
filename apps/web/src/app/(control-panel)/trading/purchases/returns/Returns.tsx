'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import { useMemo, useState } from 'react';
import ReturnsHeader from './ReturnsHeader';
import ReturnsTable from './ReturnsTable';
import { PURCHASE_RETURNS, filterPurchaseReturnsByDateRange } from './returnsListData';

type DateRange = { startDate: string; endDate: string } | null;

export default function Returns() {
	const [dateRange, setDateRange] = useState<DateRange>(null);
	const filtered = useMemo(
		() =>
			filterPurchaseReturnsByDateRange(
				PURCHASE_RETURNS,
				dateRange?.startDate ?? null,
				dateRange?.endDate ?? null
			),
		[dateRange]
	);

	return (
		<>
			<GlobalStyles styles={() => ({ '#root': { maxHeight: '100vh' } })} />
			<div className="w-full h-full flex flex-col px-4">
				<ReturnsHeader
					totalCount={filtered.length}
					dateRange={dateRange}
					onDateRangeChange={setDateRange}
				/>
				<ReturnsTable data={filtered} />
			</div>
		</>
	);
}
