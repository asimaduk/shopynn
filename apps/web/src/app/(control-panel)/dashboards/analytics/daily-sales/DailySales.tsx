'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import DailySalesHeader from './DailySalesHeader';
import DailySalesTotalWidget from './DailySalesTotalWidget';
import DailySalesTable from './DailySalesTable';
import { useGetDailySalesSummaryQuery } from './DailySalesApi';
import type { ListDailySalesArg } from './DailySalesApi';

type DateRange = { startDate: string; endDate: string } | null;

export default function DailySales() {
	const [dateRange, setDateRange] = useState<DateRange>(null);

	const queryArg = useMemo<ListDailySalesArg | undefined>(() => {
		if (!dateRange?.startDate || !dateRange?.endDate) return undefined;
		return {
			startDate: dateRange.startDate,
			endDate: dateRange.endDate
		};
	}, [dateRange]);

	const { data, isLoading, isFetching, error } = useGetDailySalesSummaryQuery(queryArg);

	const rows = data?.rows ?? [];
	const busy = isLoading || isFetching;

	return (
		<Box className="flex h-full w-full min-w-0 max-w-full flex-col px-4">
			<DailySalesHeader dateRange={dateRange} onDateRangeChange={setDateRange} loading={busy} />
			<Box className="relative min-h-[200px] min-w-0 flex-1">
				{busy && (
					<Box
						className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60"
						aria-busy
					>
						<CircularProgress />
					</Box>
				)}
				{error ? (
					<Box className="text-secondary p-8 text-center text-sm">
						Could not load daily sales. Check your connection and try again.
					</Box>
				) : (
					<>
						<DailySalesTotalWidget rows={rows} />
						<Box className="min-w-0 max-w-full overflow-x-auto">
							<DailySalesTable data={rows} />
						</Box>
					</>
				)}
			</Box>
		</Box>
	);
}
