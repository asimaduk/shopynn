'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import AdjustmentHistoryHeader from './AdjustmentHistoryHeader';
import AdjustmentHistoryTable from './AdjustmentHistoryTable';
import { useListAdjustmentsQuery } from './AdjustmentApi';
import type { ListAdjustmentsArg } from './AdjustmentApi';

type DateRange = { startDate: string; endDate: string } | null;

export default function AdjustmentHistory() {
	const [dateRange, setDateRange] = useState<DateRange>(null);

	const queryArg = useMemo<ListAdjustmentsArg | undefined>(() => {
		if (!dateRange?.startDate || !dateRange?.endDate) return undefined;
		return {
			startDate: dateRange.startDate,
			endDate: dateRange.endDate
		};
	}, [dateRange]);

	const { data: records = [], isLoading, isFetching, error } = useListAdjustmentsQuery(queryArg, {refetchOnMountOrArgChange:true});

	const busy = isLoading || isFetching;

	const { recordCount, productLinesTotal } = useMemo(() => {
		const count = records.length;
		const lines = records.reduce((s, r) => s + Number(r.productsCount ?? 0), 0);
		return { recordCount: count, productLinesTotal: lines };
	}, [records]);

	return (
		<Box className="flex h-full w-full flex-col px-4">
			<AdjustmentHistoryHeader
				recordCount={recordCount}
				productLinesTotal={productLinesTotal}
				isLoading={busy}
				dateRange={dateRange}
				onDateRangeChange={setDateRange}
			/>
			<Box className="relative min-h-[240px] flex-1">
				{busy && (
					<Box
						className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60"
						aria-busy
					>
						<CircularProgress />
					</Box>
				)}
				{error ? (
					<Box className="text-secondary p-16 text-center text-sm">
						Could not load adjustments. Check your connection and try again.
					</Box>
				) : (
					<AdjustmentHistoryTable data={records} />
				)}
			</Box>
		</Box>
	);
}
