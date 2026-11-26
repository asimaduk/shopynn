'use client';

import { useMemo, useState } from 'react';
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
import Chip from '@mui/material/Chip';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import FuseLoading from '@fuse/core/FuseLoading';
import DateRangeDialog from '@fuse/core/FuseDateSelection';
import { useParams } from 'next/navigation';
import {
	useGetContactPaymentsQuery,
	useGetContactsItemQuery
} from '../../ContactsApi';
import { formatGhsCurrency } from '@/app/(control-panel)/dashboards/analytics/daily-sales/formatGhsCurrency';

type DateRange = { startDate: string; endDate: string } | null;

function formatDateRange(dates: DateRange): string {
	if (!dates) return 'Filter by date';
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const start = new Date(dates.startDate);
	const end = new Date(dates.endDate);
	return `${months[start.getMonth()]} ${start.getDate()} – ${months[end.getMonth()]} ${end.getDate()}`;
}

function formatMethod(raw?: string | null): string {
	const v = String(raw || '').trim().toLowerCase();
	if (!v) return 'Payment';
	if (v === 'mobile_money' || v === 'momo') return 'MoMo';
	if (v === 'store_credit') return 'Store credit';
	if (v === 'card') return 'Card';
	if (v === 'cash') return 'Cash';
	return raw || 'Payment';
}

export default function ContactPaymentsPage() {
	const { contactId } = useParams<{ contactId: string }>();
	const { data: contact, isLoading, isError } = useGetContactsItemQuery(contactId ?? '', { skip: !contactId });

	const [dateRange, setDateRange] = useState<DateRange>(null);
	const [dateDialogOpen, setDateDialogOpen] = useState(false);
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(10);

	const {
		data: payments = [],
		isLoading: paymentsLoading,
		isFetching,
		isError: paymentsError
	} = useGetContactPaymentsQuery(
		{
			contactId: contactId ?? '',
			startDate: dateRange?.startDate,
			endDate: dateRange?.endDate
		},
		{ skip: !contactId }
	);

	const paginatedData = useMemo(
		() => payments.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
		[payments, page, rowsPerPage]
	);

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
							<FuseSvgIcon size={20} color="action">
								heroicons-outline:calendar-days
							</FuseSvgIcon>
							<Typography variant="body2" color="text.secondary" fontWeight={500}>
								{formatDateRange(dateRange)}
							</Typography>
							{dateRange ? (
								<Tooltip title="Clear date filter">
									<IconButton
										size="small"
										onClick={(e) => {
											e.stopPropagation();
											setDateRange(null);
											setPage(0);
										}}
										sx={{ ml: 0.5, p: 0.25 }}
									>
										<FuseSvgIcon size={16}>heroicons-outline:x-mark</FuseSvgIcon>
									</IconButton>
								</Tooltip>
							) : null}
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
							<FuseSvgIcon size={22} color="action">
								heroicons-outline:banknotes
							</FuseSvgIcon>
							<Typography variant="subtitle1" fontWeight="600">
								Payments
							</Typography>
							{(paymentsLoading || isFetching) && (
								<Typography variant="caption" color="text.secondary" className="ml-auto">
									Loading…
								</Typography>
							)}
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
								{paymentsError ? (
									<TableRow>
										<TableCell colSpan={5} align="center" sx={{ py: 6 }}>
											<Typography color="error">Could not load payments.</Typography>
										</TableCell>
									</TableRow>
								) : paginatedData.length === 0 && !paymentsLoading ? (
									<TableRow>
										<TableCell colSpan={5} align="center" sx={{ py: 6 }}>
											<FuseSvgIcon
												size={48}
												color="action"
												sx={{ opacity: 0.5, display: 'block', mx: 'auto', mb: 1 }}
											>
												heroicons-outline:banknotes
											</FuseSvgIcon>
											<Typography color="text.secondary">No payments yet</Typography>
											<Typography variant="caption" color="text.secondary">
												Collections and gateway payments for this customer appear here
											</Typography>
										</TableCell>
									</TableRow>
								) : (
									paginatedData.map((row) => (
										<TableRow key={row.id}>
											<TableCell>
												{row.created_at
													? new Date(row.created_at).toLocaleString('en-US', {
															month: 'short',
															day: 'numeric',
															year: 'numeric',
															hour: '2-digit',
															minute: '2-digit'
														})
													: '—'}
											</TableCell>
											<TableCell>{formatGhsCurrency(Number(row.amount) || 0, 2, 2)}</TableCell>
											<TableCell>
												<Box className="flex items-center gap-1">
													{formatMethod(row.payment_method_type)}
													{row.source === 'pos_sale' ? (
														<Chip size="small" label="POS" variant="outlined" />
													) : null}
												</Box>
											</TableCell>
											<TableCell>{row.status || '—'}</TableCell>
											<TableCell>{row.transaction_ref || row.payment_number || '—'}</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
						<TablePagination
							component="div"
							count={payments.length}
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
					if (dates) {
						setDateRange(dates);
						setPage(0);
					}
					setDateDialogOpen(false);
				}}
			/>
		</>
	);
}
