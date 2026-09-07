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
import { useMemo } from 'react';
import useUser from '@auth/useUser';
import { hasFeatureAndPermission } from '@auth/permissions';
import type { Purchase } from '../TradingApi';
import { formatCurrency } from 'src/app/(control-panel)/reports/reportMappers';

/**
 * The purchases header.
 */
function PurchasesHeader({
	purchases,
	isLoading,
	suppliers,
	attendants,
	handleFilter
}: {
	purchases: Purchase[];
	isLoading?: boolean;
	suppliers: any;
	attendants: any;
	handleFilter: (dates: any, supplierId?: string, attendantId?: string) => void;
}) {
	const { data: user } = useUser();
	const [openDate, setOpenDate] = useState(false);
	const isMobile = useThemeMediaQuery((theme) => theme.breakpoints.down('lg'));
	const [filterDates, setFilterDates] = useState(null);
	const [supplier, setSupplier] = useState(null);
	const [staff, setStaff] = useState(null);
	// const [totalPurchases, setTotalPurchases] = useState('0.00')

	const handleChange = (event, newValue) => {		
		setSupplier(newValue);
		handleFilter(filterDates, (newValue && newValue.id) || '', (staff && staff.id) || '')
	};

	const handleAttendantChange= (event, newValue) => {		
		setStaff(newValue);
		handleFilter(filterDates, (supplier && supplier.id) || '', (newValue && newValue.id) || '')
	};

	const handleExportExcel = () => {
		const ws = XLSX.utils.json_to_sheet(purchases.map(purc=> ({Date:purc.created_at, 'Invoice #':purc.invoice_number, Supplier:purc.supplier, 'No. of Items':purc.number_of_items, Total:purc.total_amount, Attendant: purc.attendant, Notes: purc.notes}))); // Convert data to worksheet
		const wb = XLSX.utils.book_new(); // Create new workbook
		XLSX.utils.book_append_sheet(wb, ws, 'Sheet1'); // Append worksheet to workbook
		XLSX.writeFile(wb, `Purchases || ${new Date().toJSON()}.xlsx`); // Write and download the Excel file
	};

	const filterByDate = (dates) => {
		handleFilter(dates, (supplier && supplier.id) || '')
		setFilterDates(dates);
	}

	const formatDateRange = (_dates) => {		
		const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
		let rtn = `${months[new Date(_dates.startDate).getMonth()]} ${new Date(_dates.startDate).getDate()} - ${months[new Date(_dates.endDate).getMonth()]} ${new Date(_dates.endDate).getDate()}`
		return rtn;
	}

	const totalAmount = useMemo(
		() => (purchases ?? []).reduce((a, p) => a + Number(p?.total_amount ?? 0), 0),
		[purchases]
	);
	const purchaseCount = purchases?.length ?? 0;
	const canExport = hasFeatureAndPermission(user, 'reports.export', undefined, 'reports.export');

	return (
		<div className="flex grow-0 flex-1 w-full items-center justify-between space-y-2 sm:space-y-0 py-6 sm:py-8">
			<motion.span
				initial={{ x: -20 }}
				animate={{ x: 0, transition: { delay: 0.2 } }}
			>
				<div>
					<PageBreadcrumb className="mb-2" />
					<Typography className="text-4xl font-extrabold leading-none tracking-tight">Purchases</Typography>
					<Typography
						variant="body1"
						color="text.secondary"
						className="mt-1 font-medium"
					>
						{isLoading ? (
							'…'
						) : (
							<>
								{purchaseCount} {purchaseCount === 1 ? 'record' : 'records'}
								<span className="mx-2 opacity-50">·</span>
								{formatCurrency(totalAmount)} total
							</>
						)}
					</Typography>
				</div>
			</motion.span>

			<div className="flex flex-1 items-center justify-end space-x-2">
				<Autocomplete
					disablePortal
					id="select-attendant"
					onChange={handleAttendantChange}
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
				<Autocomplete
					disablePortal
					id="select-supplier"
					onChange={handleChange}
					options={suppliers}//?.map((att, i)=> att.first_name)}
					getOptionLabel={(option:any) => option.name}
					sx={{minWidth:250, marginRight:10}}
					renderInput={(params) => (
						<TextField 
							{...params} 
							label="Supplier" 
							sx={{
								"& .MuiOutlinedInput-input": {
									height: 2, // Sets the height of the actual input element
								},
							}}
						/>
					)}
				/>
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

				{purchases?.length > 0 && canExport && (
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

export default PurchasesHeader;
