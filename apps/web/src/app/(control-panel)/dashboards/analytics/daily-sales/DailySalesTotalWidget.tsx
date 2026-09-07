'use client';

import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { lighten } from '@mui/material/styles';
import type { DailySaleRow } from './dailySalesListData';
import { aggregateDailySales } from './dailySalesListData';
import { formatGhsCurrency } from './formatGhsCurrency';

type DailySalesTotalWidgetProps = {
	rows: DailySaleRow[];
};

export default function DailySalesTotalWidget({ rows }: DailySalesTotalWidgetProps) {
	const { totalSales, totalRevenue, totalTransactions, averageOrder } =
		aggregateDailySales(rows);

	return (
		<Paper className="p-4 shadow-sm rounded-xl mb-6">
			<Typography variant="subtitle2" color="text.secondary" className="mb-3 font-medium">
				Totals (filtered)
			</Typography>
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
				<div className="flex flex-col items-center justify-center py-4 px-3 rounded-lg bg-green-50 dark:bg-green-900/20">
					<Typography className="text-2xl sm:text-3xl font-semibold text-green-800 dark:text-green-200">
						{totalSales}
					</Typography>
					<Typography variant="caption" className="font-medium text-green-700 dark:text-green-300">
						Total Sales
					</Typography>
				</div>
				<div className="flex flex-col items-center justify-center py-4 px-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
					<Typography className="text-2xl sm:text-3xl font-semibold text-blue-800 dark:text-blue-200">
						{formatGhsCurrency(totalRevenue, 0)}
					</Typography>
					<Typography variant="caption" className="font-medium text-blue-700 dark:text-blue-300">
						Total Revenue
					</Typography>
				</div>
				<Box
					className="flex flex-col items-center justify-center py-4 px-3 rounded-lg"
					sx={(theme) => ({
						backgroundColor:
							theme.palette.mode === 'light'
								? lighten(theme.palette.background.default, 0.4)
								: lighten(theme.palette.background.default, 0.02)
					})}
				>
					<Typography className="text-2xl sm:text-3xl font-semibold">
						{totalTransactions}
					</Typography>
					<Typography variant="caption" color="text.secondary" className="font-medium">
						Transactions
					</Typography>
				</Box>
				<Box
					className="flex flex-col items-center justify-center py-4 px-3 rounded-lg"
					sx={(theme) => ({
						backgroundColor:
							theme.palette.mode === 'light'
								? lighten(theme.palette.background.default, 0.4)
								: lighten(theme.palette.background.default, 0.02)
					})}
				>
					<Typography className="text-2xl sm:text-3xl font-semibold">
						{formatGhsCurrency(averageOrder, 0)}
					</Typography>
					<Typography variant="caption" color="text.secondary" className="font-medium">
						Avg Order
					</Typography>
				</Box>
			</div>
		</Paper>
	);
}
