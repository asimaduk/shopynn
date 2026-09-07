'use client';

import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { motion } from 'motion/react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import useThemeMediaQuery from '@fuse/hooks/useThemeMediaQuery';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import DateRangeDialog from '@fuse/core/FuseDateSelection';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import { useState } from 'react';

type DateRange = { startDate: string; endDate: string } | null;

function formatDateRange(dates: DateRange): string {
	if (!dates) return 'Filter by date';
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const start = new Date(dates.startDate);
	const end = new Date(dates.endDate);
	return `${months[start.getMonth()]} ${start.getDate()} – ${months[end.getMonth()]} ${end.getDate()}`;
}

type ReturnsHeaderProps = {
	totalCount: number;
	dateRange: DateRange;
	onDateRangeChange: (range: DateRange) => void;
};

export default function ReturnsHeader({
	totalCount,
	dateRange,
	onDateRangeChange
}: ReturnsHeaderProps) {
	const [openDate, setOpenDate] = useState(false);
	const isMobile = useThemeMediaQuery((theme) => theme.breakpoints.down('lg'));

	return (
		<div className="flex grow-0 flex-1 w-full items-center justify-between space-y-2 sm:space-y-0 py-6 sm:py-8">
			<motion.span initial={{ x: -20 }} animate={{ x: 0, transition: { delay: 0.2 } }}>
				<div>
					<PageBreadcrumb className="mb-2" />
					<Typography className="text-4xl font-extrabold leading-none tracking-tight">
						Purchase returns ({totalCount})
					</Typography>
					<Typography variant="body2" color="text.secondary" className="mt-1">
						History of purchase returns
					</Typography>
				</div>
			</motion.span>
			<div className="flex flex-1 items-center justify-end gap-2">
				<Button
					variant="contained"
					color="secondary"
					component={NavLinkAdapter}
					to="/trading/purchases/returns/new"
					size={isMobile ? 'small' : 'medium'}
					startIcon={<FuseSvgIcon size={20}>heroicons-outline:plus</FuseSvgIcon>}
				>
					New return
				</Button>
				<Button
					variant="contained"
					color="primary"
					onClick={() => setOpenDate(true)}
					size={isMobile ? 'small' : 'medium'}
				>
					<FuseSvgIcon size={17}>heroicons-outline:calendar-days</FuseSvgIcon>
					<span className="mx-1 sm:mx-2 mt-1">{formatDateRange(dateRange)}</span>
				</Button>
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
