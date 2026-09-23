import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useState } from 'react';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { useParams } from 'next/navigation';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { useGetSaleQuery, useRecordSalePaymentMutation } from '../../../../TradingApi';
import OrdersStatus from '../../../SalesStatus';
import GoogleAddressMap from './GoogleAddressMap';
import { formatGhsCurrency } from '../../../../../dashboards/analytics/daily-sales/formatGhsCurrency';
import { showMessage } from '@fuse/core/FuseMessage/fuseMessageSlice';
import { useAppDispatch } from 'src/store/hooks';
import useUser from '@auth/useUser';
import { hasPermissionCodes } from '@auth/permissions';

function paymentStatusLabel(status: unknown) {
	const n = Number(status);
	if (n === 1) return 'Paid';
	if (n === 2) return 'Partial';
	if (n === 0) return 'On credit';
	return '—';
}

/**
 * The order details tab.
 */
function DetailsTab() {
	const routeParams = useParams();
	const dispatch = useAppDispatch();
	const { data: user } = useUser();
	const canRecordPayment = hasPermissionCodes(user, 'sales.create');

	const { orderId } = routeParams as { orderId: string };

	const { data: order, isError, refetch } = useGetSaleQuery(orderId, {
		skip: !orderId
	});
	const [recordPayment, { isLoading: savingCollect }] = useRecordSalePaymentMutation();

	const [map, setMap] = useState<string>('shipping');
	const [collectOpen, setCollectOpen] = useState(false);
	const [collectAmount, setCollectAmount] = useState('');
	const [collectMethod, setCollectMethod] = useState('cash');
	const [collectNote, setCollectNote] = useState('');
	const [collectRef, setCollectRef] = useState('');

	if (!isError && !order) {
		return null;
	}

	const balanceDue = Number(order?.balance_due ?? 0);
	const amountPaid = Number(order?.amount_paid ?? 0);
	const storeCreditBalance = Number(order?.store_credit_balance ?? 0);
	const canCollect =
		canRecordPayment && (Boolean(order?.can_collect_payment) || balanceDue > 0.02);

	const openCollect = () => {
		setCollectAmount(balanceDue > 0 ? balanceDue.toFixed(2) : '');
		setCollectMethod('cash');
		setCollectNote('');
		setCollectRef('');
		setCollectOpen(true);
	};

	const saveCollect = async () => {
		const amt = Number(String(collectAmount).replace(/,/g, ''));
		if (!Number.isFinite(amt) || amt <= 0) {
			dispatch(showMessage({ message: 'Enter a valid collection amount' }));
			return;
		}
		if (amt > balanceDue + 0.02) {
			dispatch(
				showMessage({
					message: `Amount cannot exceed balance due (${formatGhsCurrency(balanceDue, 2, 2)})`
				})
			);
			return;
		}
		if (collectMethod === 'store_credit') {
			if (!order?.customer_id) {
				dispatch(showMessage({ message: 'Store credit requires a customer on this sale' }));
				return;
			}
			if (amt > storeCreditBalance + 0.02) {
				dispatch(
					showMessage({
						message: `Available store credit is ${formatGhsCurrency(storeCreditBalance, 2, 2)}`
					})
				);
				return;
			}
		}
		if (collectMethod === 'momo' && !String(collectRef || '').trim()) {
			dispatch(
				showMessage({
					message: 'Enter the confirmed Paystack MoMo payment reference'
				})
			);
			return;
		}
		try {
			const body: Record<string, unknown> = {
				amount: amt,
				payment_method: collectMethod,
				payment_reference: collectRef.trim() || null,
				note: collectNote.trim() || null
			};
			if (collectMethod === 'momo') {
				body.payment_transaction_ref = collectRef.trim();
			}
			await recordPayment({
				saleId: orderId,
				body
			}).unwrap();
			setCollectOpen(false);
			refetch();
			dispatch(showMessage({ message: 'Payment recorded' }));
		} catch (err: any) {
			dispatch(showMessage({ message: err?.data?.message || err?.message || 'Could not record payment' }));
		}
	};

	return (
		<div className="w-full max-w-5xl space-y-12">
			<div className="space-y-4">
				<div className="flex items-center border-b-1 space-x-2 pb-2">
					<FuseSvgIcon
						color="action"
						size={24}
					>
						heroicons-outline:user-circle
					</FuseSvgIcon>
					<Typography
						className="text-2xl"
						color="text.secondary"
					>
						Customer
					</Typography>
				</div>

				<div className="space-y-4">
					<div className="table-responsive border rounded-md">
						<table className="table dense simple">
							<thead>
								<tr>
									<th>
										<Typography className="font-semibold">Name</Typography>
									</th>
									<th>
										<Typography className="font-semibold">Email</Typography>
									</th>
									<th>
										<Typography className="font-semibold">Phone</Typography>
									</th>
									<th>
										<Typography className="font-semibold">Company</Typography>
									</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td>
										<div className="flex items-center">
											<Avatar src={'order.customer.avatar'} />
											<Typography className="truncate mx-2">
												{order.customer || 'Walk-In'}
												{/* {`${order.customer.firstName} ${order.customer.lastName}`} */}
											</Typography>
										</div>
									</td>
									<td>
										<Typography className="truncate">{order.customer_email || 'NA'}</Typography>
									</td>
									<td>
										<Typography className="truncate">{order.customer_phone || 'NA'}</Typography>
									</td>
									<td>
										<span className="truncate">{order.customer?.company || 'NA'}</span>
									</td>
								</tr>
							</tbody>
						</table>
					</div>

					{/* <div className="space-y-4">
						<Accordion
							className="border-0 shadow-0 overflow-hidden"
							expanded={map === 'shipping'}
							onChange={() => setMap(map !== 'shipping' ? 'shipping' : '')}
							sx={{ backgroundColor: 'background.default', borderRadius: '8px!important' }}
						>
							<AccordionSummary expandIcon={<ExpandMoreIcon />}>
								<Typography className="font-semibold">Shipping Address</Typography>
							</AccordionSummary>
							<AccordionDetails className="flex flex-col md:flex-row">
								<Typography className="w-full md:max-w-64 mb-4 md:mb-0 mx-2 text-lg">
									{order.customer?.shippingAddress?.address}
								</Typography>
								<div className="w-full h-80 rounded-xl overflow-hidden mx-2">
									<GoogleAddressMap
										center={{
											lng: order.customer?.shippingAddress?.lng,
											lat: order.customer?.shippingAddress?.lat
										}}
									/>
								</div>
							</AccordionDetails>
						</Accordion>

						<Accordion
							className="border-0 shadow-0 overflow-hidden"
							expanded={map === 'invoice'}
							onChange={() => setMap(map !== 'invoice' ? 'invoice' : '')}
							sx={{ backgroundColor: 'background.default', borderRadius: '8px!important' }}
						>
							<AccordionSummary expandIcon={<ExpandMoreIcon />}>
								<Typography className="font-semibold">Invoice Address</Typography>
							</AccordionSummary>
							<AccordionDetails className="flex flex-col md:flex-row -mx-2">
								<Typography className="w-full md:max-w-64 mb-4 md:mb-0 mx-2 text-lg">
									{order.customer_address}
								</Typography>
								<div className="w-full h-80 rounded-xl overflow-hidden mx-2">
									<GoogleAddressMap
										center={{
											lng: -0.205874,//order.customer?.invoiceAddress.lng,
											lat: 5.614818//order.customer?.invoiceAddress.lat
										}}
									/>
								</div>
							</AccordionDetails>
						</Accordion>
					</div> */}
				</div>
			</div>

			<div className="space-y-4">
				<div className="flex items-center border-b-1 space-x-2 pb-2">
					<FuseSvgIcon
						color="action"
						size={24}
					>
						heroicons-outline:hashtag
					</FuseSvgIcon>
					<Typography
						className="text-2xl"
						color="text.secondary"
					>
						Payment
					</Typography>
				</div>

				<div className="table-responsive border rounded-md">
					<table className="simple">
						<thead>
							<tr>
								<th>
									<Typography className="font-semibold">TransactionID</Typography>
								</th>
								<th>
									<Typography className="font-semibold">Payment Method</Typography>
								</th>
								<th>
									<Typography className="font-semibold">Status</Typography>
								</th>
								<th>
									<Typography className="font-semibold">Paid</Typography>
								</th>
								<th>
									<Typography className="font-semibold">Balance</Typography>
								</th>
								<th>
									<Typography className="font-semibold">Total</Typography>
								</th>
								<th>
									<Typography className="font-semibold">Date</Typography>
								</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>
									<span className="truncate">{order.payment_reference || 'N/A'}</span>
								</td>
								<td>
									<span className="truncate">{order.payment_type == 2 ? 'Momo':'Cash'}</span>
								</td>
								<td>
									<span className="truncate">{paymentStatusLabel(order.payment_status)}</span>
								</td>
								<td>
									<span className="truncate font-[tabular-nums]">
										{formatGhsCurrency(amountPaid, 2, 2)}
									</span>
								</td>
								<td>
									<span className="truncate font-[tabular-nums]">
										{formatGhsCurrency(balanceDue, 2, 2)}
									</span>
								</td>
								<td>
									<span className="truncate font-[tabular-nums]">
										{formatGhsCurrency(
											Number(String(order.total_amount ?? 0).replace(/,/g, '')),
											2,
											2
										)}
									</span>
								</td>
								<td>
									<span className="truncate">{new Date(order.created_at).toDateString()}</span>
								</td>
							</tr>
						</tbody>
					</table>
				</div>

				{canCollect ? (
					<div className="flex justify-end">
						<Button variant="contained" color="secondary" onClick={openCollect}>
							Collect payment
						</Button>
					</div>
				) : null}

				{Array.isArray(order.payments) && order.payments.length > 0 ? (
					<div className="table-responsive border rounded-md">
						<table className="simple dense">
							<thead>
								<tr>
									<th>
										<Typography className="font-semibold">When</Typography>
									</th>
									<th>
										<Typography className="font-semibold">Method</Typography>
									</th>
									<th>
										<Typography className="font-semibold">Amount</Typography>
									</th>
									<th>
										<Typography className="font-semibold">Note</Typography>
									</th>
								</tr>
							</thead>
							<tbody>
								{order.payments.map((p: any) => (
									<tr key={p.id}>
										<td>
											<span className="truncate">
												{p.created_at ? new Date(p.created_at).toLocaleString() : '—'}
											</span>
										</td>
										<td>
											<span className="truncate">{String(p.payment_method || '').toUpperCase()}</span>
										</td>
										<td>
											<span className="truncate font-[tabular-nums]">
												{formatGhsCurrency(Number(p.amount) || 0, 2, 2)}
											</span>
										</td>
										<td>
											<span className="truncate">{p.note || '—'}</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : null}
			</div>

			<Dialog open={collectOpen} onClose={() => !savingCollect && setCollectOpen(false)} fullWidth maxWidth="xs">
				<DialogTitle>Collect payment</DialogTitle>
				<DialogContent className="flex flex-col gap-3 pt-2">
					<Typography variant="body2" color="text.secondary">
						Balance due {formatGhsCurrency(balanceDue, 2, 2)}
					</Typography>
					{storeCreditBalance > 0.001 ? (
						<Typography variant="body2" color="text.secondary">
							Store credit available {formatGhsCurrency(storeCreditBalance, 2, 2)}
						</Typography>
					) : null}
					<TextField
						label="Amount"
						type="number"
						value={collectAmount}
						onChange={(e) => setCollectAmount(e.target.value)}
						fullWidth
						InputLabelProps={{ shrink: true }}
					/>
					<TextField
						select
						label="Method"
						value={collectMethod}
						onChange={(e) => {
							const next = e.target.value;
							setCollectMethod(next);
							if (next === 'store_credit' && storeCreditBalance > 0.001) {
								setCollectAmount(Math.min(balanceDue, storeCreditBalance).toFixed(2));
							}
						}}
						fullWidth
					>
						<MenuItem value="cash">Cash</MenuItem>
						<MenuItem value="momo">MoMo</MenuItem>
						<MenuItem value="store_credit">Store credit</MenuItem>
					</TextField>
					{collectMethod === 'momo' ? (
						<TextField
							label="Paystack reference (required)"
							value={collectRef}
							onChange={(e) => setCollectRef(e.target.value)}
							helperText="Confirmed MoMo transaction reference from Paystack"
							fullWidth
						/>
					) : null}
					<TextField
						label="Note (optional)"
						value={collectNote}
						onChange={(e) => setCollectNote(e.target.value)}
						fullWidth
					/>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setCollectOpen(false)} disabled={savingCollect}>
						Cancel
					</Button>
					<Button variant="contained" onClick={saveCollect} disabled={savingCollect}>
						{savingCollect ? 'Saving…' : 'Record'}
					</Button>
				</DialogActions>
			</Dialog>

			{/* <div className="space-y-4">
				<div className="flex items-center border-b-1 space-x-2 pb-2">
					<FuseSvgIcon
						color="action"
						size={24}
					>
						heroicons-outline:clock
					</FuseSvgIcon>
					<Typography
						className="text-2xl"
						color="text.secondary"
					>
						Order Status
					</Typography>
				</div>

				<div className="table-responsive border rounded-md">
					<Table className="simple">
						<TableHead>
							<TableRow>
								<TableCell>
									<Typography className="font-semibold">Status</Typography>
								</TableCell>
								<TableCell>
									<Typography className="font-semibold">Updated On</Typography>
								</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{order.status?.map((status) => (
								<TableRow key={status.id}>
									<TableCell>
										<OrdersStatus name={status.name} />
									</TableCell>
									<TableCell>{status.date}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			</div> */}

			{/* <div className="space-y-4">
				<div className="flex items-center border-b-1 space-x-2 pb-2">
					<FuseSvgIcon
						color="action"
						size={24}
					>
						heroicons-outline:truck
					</FuseSvgIcon>
					<Typography
						className="text-2xl"
						color="text.secondary"
					>
						Shipping
					</Typography>
				</div>

				<div className="table-responsive border rounded-md">
					<table className="simple dense">
						<thead>
							<tr>
								<th>
									<Typography className="font-semibold">Tracking Code</Typography>
								</th>
								<th>
									<Typography className="font-semibold">Carrier</Typography>
								</th>
								<th>
									<Typography className="font-semibold">Weight</Typography>
								</th>
								<th>
									<Typography className="font-semibold">Fee</Typography>
								</th>
								<th>
									<Typography className="font-semibold">Date</Typography>
								</th>
							</tr>
						</thead>
						<tbody>
							{order.shippingDetails?.map((shipping) => (
								<tr key={shipping.date}>
									<td>
										<span className="truncate">{shipping.tracking}</span>
									</td>
									<td>
										<span className="truncate">{shipping.carrier}</span>
									</td>
									<td>
										<span className="truncate">{shipping.weight}</span>
									</td>
									<td>
										<span className="truncate">{shipping.fee}</span>
									</td>
									<td>
										<span className="truncate">{shipping.date}</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div> */}
		</div>
	);
}

export default DetailsTab;
