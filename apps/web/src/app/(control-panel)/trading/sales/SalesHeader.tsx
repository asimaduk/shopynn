import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { motion } from 'motion/react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import useThemeMediaQuery from '@fuse/hooks/useThemeMediaQuery';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import * as XLSX from 'xlsx';
import DateRangeDialog from '@fuse/core/FuseDateSelection';
import { useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import { TextField } from '@mui/material';
import useUser from '@auth/useUser';
import { hasFeatureAndPermission } from '@auth/permissions';
import { useMemo } from 'react';
import type { Sale } from '../TradingApi';
import { formatGhsCurrency } from '../../dashboards/analytics/daily-sales/formatGhsCurrency';

/**
 * The sales header.
 */
function SalesHeader({
	sales,
	isLoading,
	attendants,
	handleFilter,
	soldByDisplayName
}: {
	sales: Sale[];
	isLoading?: boolean;
	attendants: any;
	handleFilter: (dates: any, attendantId?: string) => void;
	/** When opening sales from a user link (?soldByName=…) — show who the list is scoped to. */
	soldByDisplayName?: string | null;
}) {
	const { data: user } = useUser();
	const [openDate, setOpenDate] = useState(false);
	const isMobile = useThemeMediaQuery((theme) => theme.breakpoints.down('lg'));
	const [filterDates, setFilterDates] = useState(null);
	const [salesRep, setSalesRep] = useState(null);
	// const [totalSales, setTotalSales] = useState('0.00')

	const handleChange = (event, newValue) => {		
		setSalesRep(newValue);
		handleFilter(filterDates, (newValue && newValue.id) || '')
	};

	const handleExportExcel = () => {
		const ws = XLSX.utils.json_to_sheet(sales.map(sale=> ({Date:sale.created_at, Reference:sale.invoice_number, Customer:sale.customer||'WalkI n', 'No. of Items':sale.number_of_items, Total:sale.total_amount, Attendant: sale.attendant, Notes: sale.notes}))); // Convert data to worksheet
		const wb = XLSX.utils.book_new(); // Create new workbook
		XLSX.utils.book_append_sheet(wb, ws, 'Sheet1'); // Append worksheet to workbook
		XLSX.writeFile(wb, `Sales || ${new Date().toJSON()}.xlsx`); // Write and download the Excel file
	};

	const filterByDate = (dates) => {
		handleFilter(dates, (salesRep && salesRep.id) || '')
		setFilterDates(dates);
	}

	const formatDateRange = (_dates) => {		
		const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
		let rtn = `${months[new Date(_dates.startDate).getMonth()]} ${new Date(_dates.startDate).getDate()} - ${months[new Date(_dates.endDate).getMonth()]} ${new Date(_dates.endDate).getDate()}`
		return rtn;
	}

	const totalAmount = useMemo(
		() => (sales ?? []).reduce((a, s) => a + Number(s?.total_amount ?? 0), 0),
		[sales]
	);
	const saleCount = sales?.length ?? 0;
	const canExport = hasFeatureAndPermission(user, 'reports.export', undefined, 'reports.export');

	return (
		<div className="flex grow-0 flex-1 w-full items-center justify-between space-y-2 sm:space-y-0 py-6 sm:py-8">
			<motion.span
				initial={{ x: -20 }}
				animate={{ x: 0, transition: { delay: 0.2 } }}
			>
				<div>
					<PageBreadcrumb className="mb-2" />
					<Typography className="text-4xl font-extrabold leading-none tracking-tight">Sales</Typography>
					<Typography
						variant="body1"
						color="text.secondary"
						className="mt-1 font-medium"
					>
						{isLoading ? (
							soldByDisplayName ? (
								<>
									…
									<span className="mx-2 opacity-50">·</span>
									Sales by {soldByDisplayName}
								</>
							) : (
								'…'
							)
						) : (
							<>
								{saleCount} {saleCount === 1 ? 'record' : 'records'}
								<span className="mx-2 opacity-50">·</span>
								{formatGhsCurrency(totalAmount, 2, 2)} total
								{soldByDisplayName ? (
									<>
										<span className="mx-2 opacity-50">·</span>
										Sales by {soldByDisplayName}
									</>
								) : null}
							</>
						)}
					</Typography>
				</div>
			</motion.span>

			<div className="flex flex-1 items-center justify-end space-x-2">
				{user.role==='admin' && (
					<Autocomplete
						disablePortal
						id="select-attendant"
						onChange={handleChange}
						options={attendants}//?.map((att, i)=> att.first_name)}
						getOptionLabel={(option:any) => (`${option.first_name} ${option.last_name}`)}
						getOptionKey={(option) => option.username}
						sx={{minWidth:200, marginRight:10}}
						renderInput={(params) => (
							<TextField 
								{...params} 
								label="Attendant" 
								sx={{
									"& .MuiOutlinedInput-input": {
										height: 2, // Sets the height of the actual input element
									},
								}}
							/>
						)}
					/>
				)}
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

				{sales?.length > 0 && canExport && (
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

export default SalesHeader;
