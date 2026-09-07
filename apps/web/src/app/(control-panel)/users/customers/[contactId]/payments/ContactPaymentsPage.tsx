'use client';

import { useState, useMemo } from 'react';
import GlobalStyles from '@mui/material/GlobalStyles';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import FuseLoading from '@fuse/core/FuseLoading';
import DateRangeDialog from '@fuse/core/FuseDateSelection';
import { useParams } from 'next/navigation';
import { useGetContactsItemQuery } from '../../ContactsApi';

type DateRange = { startDate: string; endDate: string } | null;

function formatDateRange(dates: DateRange): string {
	if (!dates) return 'Filter by date';
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const start = new Date(dates.startDate);
	const end = new Date(dates.endDate);
	return `${months[start.getMonth()]} ${start.getDate()} – ${months[end.getMonth()]} ${end.getDate()}`;
}

export default function ContactPaymentsPage() {
	const { contactId } = useParams<{ contactId: string }>();
	const { data: contact, isLoading, isError } = useGetContactsItemQuery(contactId ?? '', { skip: !contactId });

	const [dateRange, setDateRange] = useState<DateRange>(null);
	const [dateDialogOpen, setDateDialogOpen] = useState(false);
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(10);

	// TODO: replace with API data filtered by dateRange; then paginate
	const filteredData = useMemo(() => [], [dateRange]);
	const paginatedData = useMemo(
		() => filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
		[filteredData, page, rowsPerPage]
	);
	const emptyRows = Math.max(0, rowsPerPage - paginatedData.length);

	const handlePageChange = (_: unknown, newPage: number) => setPage(newPage);
	const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setRowsPerPage(parseInt(e.target.value, 10));
		setPage(0);
	};

	if (isLoading) return <FuseLoading />;
	if (isError || !contact) {
		return (
			<Box className="p-6 text-center">
				<Typography color="text.secondary">Contact not found.</Typography>
				<Button component={NavLinkAdapter} to="/users/customers" sx={{ mt: 2 }}>
					Back to customers
				</Button>
			</Box>
		);
	}

	const contactName = contact.name ?? 'Customer';

	return (
		<>
			<GlobalStyles styles={() => ({ '#root': { maxHeight: '100vh' } })} />
			<div className="w-full min-h-full flex flex-col px-4 py-6">
				<Box className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
					<Box className="flex items-center gap-3">
						<Box
							className="flex items-center justify-center rounded-xl shrink-0"
							sx={{ width: 48, height: 48, bgcolor: 'primary.main', color: 'primary.contrastText' }}
						>
							<FuseSvgIcon size={26}>heroicons-outline:banknotes</FuseSvgIcon>
						</Box>
						<div>
							<Typography variant="h5" fontWeight="bold">
								Payment history
							</Typography>
							<Typography variant="body2" color="text.secondary">
								{contactName}
							</Typography>
						</div>
					</Box>
					<Box className="flex items-center gap-3">
						<Box
							component="button"
							type="button"
							onClick={() => setDateDialogOpen(true)}
							className="flex items-center gap-2 rounded-xl border border-solid outline-none cursor-pointer min-w-0"
							sx={{
								py: 1,
								px: 2,
								borderColor: 'divider',
								bgcolor: 'action.hover',
								'&:hover': { bgcolor: 'action.selected' }
							}}
						>
							<FuseSvgIcon size={20} color="action">heroicons-outline:calendar-days</FuseSvgIcon>
							<Typography variant="body2" color="text.secondary" fontWeight={500}>
								{formatDateRange(dateRange)}
							</Typography>
							{dateRange && (
								<Tooltip title="Clear date filter">
									<IconButton
										size="small"
										onClick={(e) => {
											e.stopPropagation();
											setDateRange(null);
										}}
										sx={{ ml: 0.5, p: 0.25 }}
									>
										<FuseSvgIcon size={16}>heroicons-outline:x-mark</FuseSvgIcon>
									</IconButton>
								</Tooltip>
							)}
						</Box>
						<Button
							component={NavLinkAdapter}
							to={`/users/customers/${contactId}/view`}
							variant="outlined"
							size="small"
							startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
						>
							Back to contact
						</Button>
					</Box>
				</Box>

				<Box className="max-w-4xl w-full mx-auto">
					<Paper variant="outlined" className="rounded-xl overflow-hidden" sx={{ borderColor: 'divider' }}>
						<Box className="flex items-center gap-2 p-4 border-b" sx={{ borderColor: 'divider' }}>
							<FuseSvgIcon size={22} color="action">heroicons-outline:banknotes</FuseSvgIcon>
							<Typography variant="subtitle1" fontWeight="600">
								Payments
							</Typography>
						</Box>
						<Table size="medium">
							<TableHead>
								<TableRow>
									<TableCell>Date</TableCell>
									<TableCell>Amount</TableCell>
									<TableCell>Method</TableCell>
									<TableCell>Status</TableCell>
									<TableCell>Reference</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{/* TODO: replace with API data - use contactId to fetch payments; map paginatedData to rows */}
								{paginatedData.length === 0 ? (
									<TableRow>
										<TableCell colSpan={5} align="center" sx={{ py: 6 }}>
											<FuseSvgIcon size={48} color="action" sx={{ opacity: 0.5, display: 'block', mx: 'auto', mb: 1 }}>
												heroicons-outline:banknotes
											</FuseSvgIcon>
											<Typography color="text.secondary">No payments yet</Typography>
											<Typography variant="caption" color="text.secondary">
												Payments for this customer will appear here
											</Typography>
										</TableCell>
									</TableRow>
								) : (
									<>
										{paginatedData.map((row: { id: string; date: string; amount: string; method: string; status: string; reference: string }, index: number) => (
											<TableRow key={row.id ?? index}>
												<TableCell>{new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</TableCell>
												<TableCell>{row.amount}</TableCell>
												<TableCell>{row.method}</TableCell>
												<TableCell>{row.status}</TableCell>
												<TableCell>{row.reference ?? '—'}</TableCell>
											</TableRow>
										))}
										{emptyRows > 0 && (
											<TableRow style={{ height: 53 * emptyRows }}>
												<TableCell colSpan={5} />
											</TableRow>
										)}
									</>
								)}
							</TableBody>
						</Table>
						<TablePagination
							component="div"
							count={filteredData.length}
							page={page}
							onPageChange={handlePageChange}
							rowsPerPage={rowsPerPage}
							onRowsPerPageChange={handleRowsPerPageChange}
							rowsPerPageOptions={[5, 10, 25]}
							labelRowsPerPage="Rows:"
						/>
					</Paper>
				</Box>
			</div>
			<DateRangeDialog
				open={dateDialogOpen}
				handleClose={(dates: DateRange) => {
					if (dates) setDateRange(dates);
					setDateDialogOpen(false);
				}}
			/>
		</>
	);
}
