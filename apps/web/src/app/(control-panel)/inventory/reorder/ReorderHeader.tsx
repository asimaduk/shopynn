'use client';

import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { motion } from 'motion/react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import useThemeMediaQuery from '@fuse/hooks/useThemeMediaQuery';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import DateRangeDialog from '@fuse/core/FuseDateSelection';
import { useState } from 'react';

type DateRange = { startDate: string; endDate: string } | null;

function formatDateRange(dates: DateRange): string {
	if (!dates) return 'Filter by date';
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const start = new Date(dates.startDate);
	const end = new Date(dates.endDate);
	return `${months[start.getMonth()]} ${start.getDate()} – ${months[end.getMonth()]} ${end.getDate()}`;
}

type ReorderHeaderProps = {
	itemCount: number;
	criticalCount: number;
	shortfallUnits: number;
	isLoading?: boolean;
	dateRange: DateRange;
	onDateRangeChange: (range: DateRange) => void;
};

export default function ReorderHeader({
	itemCount,
	criticalCount,
	shortfallUnits,
	isLoading,
	dateRange,
	onDateRangeChange
}: ReorderHeaderProps) {
	const [openDate, setOpenDate] = useState(false);
	const isMobile = useThemeMediaQuery((theme) => theme.breakpoints.down('lg'));

	return (
		<div className="flex grow-0 flex-1 w-full items-center justify-between space-y-2 sm:space-y-0 py-6 sm:py-8">
			<motion.span
				initial={{ x: -20 }}
				animate={{ x: 0, transition: { delay: 0.2 } }}
			>
				<div>
					<PageBreadcrumb className="mb-2" />
					<Typography className="text-4xl font-extrabold leading-none tracking-tight">Items to reorder</Typography>
					<Typography
						variant="body1"
						color="text.secondary"
						className="mt-1 font-medium"
					>
						{isLoading ? (
							'…'
						) : (
							<>
								{itemCount} {itemCount === 1 ? 'item' : 'items'}
								<span className="mx-2 opacity-50">·</span>
								{criticalCount} {criticalCount === 1 ? 'line' : 'lines'} at zero stock
								<span className="mx-2 opacity-50">·</span>
								{shortfallUnits.toLocaleString()} units below reorder
							</>
						)}
					</Typography>
				</div>
			</motion.span>

			<div className="flex flex-1 items-center justify-end space-x-2">
				<motion.div
					className="flex grow-0"
					initial={{ opacity: 0, x: 20 }}
					animate={{ opacity: 1, x: 0, transition: { delay: 0.2 } }}
				>
					<Button
						variant="contained"
						color="primary"
						onClick={() => setOpenDate(true)}
						size={isMobile ? 'small' : 'medium'}
					>
						<FuseSvgIcon size={17}>heroicons-outline:calendar-days</FuseSvgIcon>
						<span className="mx-1 sm:mx-2 mt-1">{formatDateRange(dateRange)}</span>
					</Button>
				</motion.div>
			</div>

			<DateRangeDialog
				open={openDate}
				handleClose={(dates: DateRange) => {
					if (dates) onDateRangeChange(dates);
					setOpenDate(false);
				}}
			/>
		</div>
	);
}
