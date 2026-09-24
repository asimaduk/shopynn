'use client';

import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import toast from 'react-hot-toast';
import { useReceiveTransferMutation } from '../../../../ECommerceApi';

/**
 * The order details tab — includes receive handoff when pending.
 */
function DetailsTab({ transfer, onReceived }: { transfer: any; onReceived?: () => void }) {
	const [receiveTransfer, { isLoading }] = useReceiveTransferMutation();
	const isPending = String(transfer?.status || '').toLowerCase() === 'pending';
	const [allReceived, setAllReceived] = useState(true);
	const [qtyByDetail, setQtyByDetail] = useState<Record<string, string>>({});

	const products = useMemo(
		() => (Array.isArray(transfer?.products) ? transfer.products : []),
		[transfer?.products]
	);

	useEffect(() => {
		const next: Record<string, string> = {};
		for (const p of products) {
			const key = String(p.detail_id || p.product_id || p.name);
			next[key] = String(p.quantity_received ?? p.quantity ?? 0);
		}
		setQtyByDetail(next);
		setAllReceived(true);
	}, [products, transfer?.id]);

	const creatorName = [transfer?.first_name, transfer?.last_name].filter(Boolean).join(' ') || '—';
	const receiverName = [transfer?.receiver_first_name, transfer?.receiver_last_name]
		.filter(Boolean)
		.join(' ');
	const statusLabel =
		transfer?.status_label ||
		(isPending ? 'Pending' : transfer?.status === 'received' ? 'Received' : transfer?.status || '—');

	const handleReceive = async () => {
		try {
			const body = allReceived
				? { id: transfer.id, all_received: true }
				: {
						id: transfer.id,
						all_received: false,
						lines: products.map((p: any) => {
							const key = String(p.detail_id || p.product_id || p.name);
							return {
								detail_id: p.detail_id,
								product_id: p.product_id,
								quantity_received: Number(qtyByDetail[key] ?? 0)
							};
						})
					};
			const res = await receiveTransfer(body).unwrap();
			const shorts = Array.isArray(res?.shortfalls) ? res.shortfalls.filter((s: any) => s.shortfall > 0) : [];
			toast.success(
				shorts.length
					? `Received with ${shorts.length} shortfall line(s) recorded.`
					: 'Transfer received — stock added to destination.'
			);
			onReceived?.();
		} catch (e: any) {
			toast.error(e?.data?.message || e?.message || 'Could not receive transfer.');
		}
	};

	return (
		<div className="w-full max-w-5xl space-y-12">
			<div className="space-y-4">
				<div className="flex flex-wrap items-center gap-2 mb-2">
					<Chip
						size="small"
						label={statusLabel}
						color={isPending ? 'warning' : 'success'}
						variant="outlined"
					/>
				</div>
				<div className="table-responsive border rounded-md">
					<table className="table dense simple">
						<thead>
							<tr>
								<th>
									<Typography className="font-semibold">From</Typography>
								</th>
								<th>
									<Typography className="font-semibold">To</Typography>
								</th>
								<th>
									<Typography className="font-semibold">Items</Typography>
								</th>
								<th>
									<Typography className="font-semibold">Sent by</Typography>
								</th>
								<th>
									<Typography className="font-semibold">Received by</Typography>
								</th>
								<th>
									<Typography className="font-semibold">Date</Typography>
								</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>
									<Typography className="truncate mx-2">{transfer.source}</Typography>
								</td>
								<td>
									<Typography className="truncate">{transfer.destination}</Typography>
								</td>
								<td>
									<Typography className="truncate">{transfer.number_of_items}</Typography>
								</td>
								<td>
									<span className="truncate">{creatorName}</span>
								</td>
								<td>
									<span className="truncate">{receiverName || (isPending ? '—' : '—')}</span>
								</td>
								<td>
									<span className="truncate">
										{transfer.created_at
											? new Date(transfer.created_at).toLocaleString()
											: '—'}
									</span>
								</td>
							</tr>
						</tbody>
					</table>
				</div>

				{isPending ? (
					<Box className="border rounded-md p-4 space-y-4 bg-amber-50/40 dark:bg-amber-900/10">
						<Typography variant="subtitle1" className="font-semibold">
							Receive this transfer
						</Typography>
						<Typography variant="body2" color="text.secondary">
							Confirm goods arrived. Tick “all received” if counts match, or enter what you actually got
							per line. Shortfalls stay out of destination stock for accountability.
						</Typography>
						<FormControlLabel
							control={
								<Checkbox
									checked={allReceived}
									onChange={(e) => setAllReceived(e.target.checked)}
								/>
							}
							label="All quantities received as sent"
						/>
						{!allReceived ? (
							<div className="table-responsive border rounded-md">
								<table className="table dense simple">
									<thead>
										<tr>
											<th>
												<Typography className="font-semibold">Product</Typography>
											</th>
											<th>
												<Typography className="font-semibold">Sent</Typography>
											</th>
											<th>
												<Typography className="font-semibold">Received</Typography>
											</th>
										</tr>
									</thead>
									<tbody>
										{products.map((p: any) => {
											const key = String(p.detail_id || p.product_id || p.name);
											return (
												<tr key={key}>
													<td>
														<Typography>{p.name}</Typography>
													</td>
													<td>
														<Typography>{p.quantity}</Typography>
													</td>
													<td>
														<TextField
															size="small"
															type="number"
															value={qtyByDetail[key] ?? ''}
															onChange={(e) =>
																setQtyByDetail((prev) => ({
																	...prev,
																	[key]: e.target.value
																}))
															}
															inputProps={{ min: 0, max: Number(p.quantity) || undefined, step: 'any' }}
															sx={{ width: 120 }}
														/>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						) : null}
						<Button
							variant="contained"
							color="primary"
							disabled={isLoading}
							onClick={() => void handleReceive()}
						>
							{isLoading ? 'Receiving…' : 'Confirm receive'}
						</Button>
					</Box>
				) : null}
			</div>
		</div>
	);
}

export default DetailsTab;
