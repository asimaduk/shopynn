import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { motion } from 'motion/react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import useThemeMediaQuery from '@fuse/hooks/useThemeMediaQuery';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
// import { useGetProductTransfersQuery } from '../ECommerceApi';
import * as XLSX from 'xlsx';
// import { useSearchParams } from 'next/navigation';
import DateRangeDialog from '@fuse/core/FuseDateSelection';
import { useState } from 'react';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import useUser from '@auth/useUser';
import { hasFeatureAndPermission } from '@auth/permissions';
import type { EcommerceTransfer } from '../ECommerceApi';

export type TransfersHeaderProps = {
	transfers: EcommerceTransfer[];
	isLoading?: boolean;
	handleFilterByDate: (dates: { startDate: string; endDate: string }) => void;
};

/**
 * The transfers header.
 */
function TransfersHeader({ transfers, isLoading, handleFilterByDate }: TransfersHeaderProps) {
	const { data: user } = useUser();
	const [openDate, setOpenDate] = useState(false);
	const isMobile = useThemeMediaQuery((theme) => theme.breakpoints.down('lg'));
	const [filterDates, setFilterDates] = useState(null)
	const canExport = hasFeatureAndPermission(user, 'reports.export', undefined, 'reports.export');
	// const { data: transfers, isLoading } = useGetProductTransfersQuery(null, {refetchOnMountOrArgChange:true});

	const handleExportExcel = () => {
		const ws = XLSX.utils.json_to_sheet(transfers.map(p=> ({Source:p.source, Destination:p.destination, Quantity:p.number_of_items, Note:p.notes, 'Done By': `${p.first_name||''} ${p.last_name||''}`, Date:p.created_at}))); // Convert data to worksheet
		const wb = XLSX.utils.book_new(); // Create new workbook
		XLSX.utils.book_append_sheet(wb, ws, 'Sheet1'); // Append worksheet to workbook
		XLSX.writeFile(wb, `Transfers || ${new Date().toJSON()}.xlsx`); // Write and download the Excel file
	};

	const filterByDate = (dates) => {
		handleFilterByDate(dates)
		setFilterDates(dates);
	}

	const formatDateRange = (_dates) => {		
		const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
		let rtn = `${months[new Date(_dates.startDate).getMonth()]} ${new Date(_dates.startDate).getDate()} - ${months[new Date(_dates.endDate).getMonth()]} ${new Date(_dates.endDate).getDate()}`
		return rtn;
	}
	
	return (
		<div className="flex grow-0 flex-1 w-full items-center justify-between space-y-2 sm:space-y-0 py-6 sm:py-8">
			<motion.span
				initial={{ x: -20 }}
				animate={{ x: 0, transition: { delay: 0.2 } }}
			>
				<div>
					<PageBreadcrumb className="mb-2" />
					<Typography className="text-4xl font-extrabold leading-none tracking-tight">Transfers</Typography>
					<Typography
						variant="body1"
						color="text.secondary"
						className="mt-1 font-medium"
					>
						{isLoading ? (
							'…'
						) : (
							<>
								{transfers?.length ?? 0}{' '}
								{(transfers?.length ?? 0) === 1 ? 'transfer' : 'transfers'}
								<span className="mx-2 opacity-50">·</span>
								{(transfers ?? []).reduce((s, t) => s + Number(t.number_of_items ?? 0), 0).toLocaleString()}{' '}
								total qty moved
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
						className=""
						variant="contained"
						color="primary"
						onClick={()=> setOpenDate(true)}
						size={isMobile ? 'small' : 'medium'}
					>
						<FuseSvgIcon size={17}>heroicons-outline:calendar-days</FuseSvgIcon>
						<span className="mx-1 sm:mx-2 mt-1">{filterDates ? formatDateRange(filterDates) : 'Filter By Date'}</span>
					</Button>
				</motion.div>

				{transfers?.length > 0 && canExport && (
					<motion.div
						className="flex grow-0"
						initial={{ opacity: 0, x: 20 }}
						animate={{ opacity: 1, x: 0, transition: { delay: 0.2 } }}
					>
						<Button
							className=""
							variant="contained"
							color="secondary"
							onClick={handleExportExcel}
							size={isMobile ? 'small' : 'medium'}
						>
							<FuseSvgIcon size={20}>heroicons-outline:cloud-arrow-down</FuseSvgIcon>
							<span className="mx-1 sm:mx-2 mt-1">Export</span>
						</Button>
					</motion.div>
				)}

				<motion.div
					className="flex grow-0"
					initial={{ opacity: 0, x: 20 }}
					animate={{ opacity: 1, x: 0, transition: { delay: 0.2 } }}
				>
					<Button
						className=""
						variant="contained"
						color="secondary"
						component={NavLinkAdapter}
						to="/inventory/newtransfer"
						size={isMobile ? 'small' : 'medium'}
					>
						<FuseSvgIcon size={20}>heroicons-outline:plus</FuseSvgIcon>
						<span className="mx-1 sm:mx-2">New</span>
					</Button>
				</motion.div>
			</div>

			<DateRangeDialog
				handleClose={(dates)=> {
					if(dates) {
						filterByDate(dates)
					}
					setOpenDate(false)
				}}	
				open={openDate}
			/>
		</div>
	);
}

export default TransfersHeader;
