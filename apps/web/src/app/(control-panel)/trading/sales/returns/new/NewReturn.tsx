'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import NewReturnHeader from './NewReturnHeader';
import {
	useCreateReturnMutation,
	useLazyGetSaleReturnableQuery,
	useLazyGetOrderReturnableQuery
} from '../../../TradingApi';
import { showMessage } from '@fuse/core/FuseMessage/fuseMessageSlice';
import { useAppDispatch } from 'src/store/hooks';
import { formatGhsCurrency } from '../../../../dashboards/analytics/daily-sales/formatGhsCurrency';

const REASONS = ['Defective', 'Wrong item', 'Customer change of mind', 'Damaged', 'Other'];

export default function NewReturn() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const saleIdParam = searchParams.get('saleId');
	const orderIdParam = searchParams.get('orderId');
	const dispatch = useAppDispatch();

	const [fetchSaleReturnable] = useLazyGetSaleReturnableQuery();
	const [fetchOrderReturnable] = useLazyGetOrderReturnableQuery();
	const [createReturn, { isLoading: submitting }] = useCreateReturnMutation();

	const [sourceType, setSourceType] = useState<'sale' | 'order'>(orderIdParam ? 'order' : 'sale');
	const [sourceId, setSourceId] = useState(orderIdParam || saleIdParam || '');
	const [payload, setPayload] = useState<any>(null);
	const [qtys, setQtys] = useState<Record<string, string>>({});
	const [restockMap, setRestockMap] = useState<Record<string, boolean>>({});
	const [reason, setReason] = useState('');
	const [notes, setNotes] = useState('');
	const [refundMethod, setRefundMethod] = useState('cash');
	const [refundAmount, setRefundAmount] = useState('');
	const [loading, setLoading] = useState(false);

	const loadSource = async () => {
		if (!sourceId.trim()) {
			dispatch(showMessage({ message: 'Enter a sale or order id' }));
			return;
		}
		setLoading(true);
		try {
			const res =
				sourceType === 'sale'
					? await fetchSaleReturnable(sourceId.trim()).unwrap()
					: await fetchOrderReturnable(sourceId.trim()).unwrap();
			setPayload(res);
			const nextQty: Record<string, string> = {};
			const nextRestock: Record<string, boolean> = {};
			(res.lines || []).forEach((line: any) => {
				const key = line.sale_detail_id || line.order_item_id;
				nextQty[key] = '';
				const defaultRestock =
					sourceType === 'order'
						? res?.default_restock !== false
						: true;
				nextRestock[key] = defaultRestock;
			});
			setQtys(nextQty);
			setRestockMap(nextRestock);
			setRefundAmount('');
		} catch (err: any) {
			dispatch(showMessage({ message: err?.data?.message || err?.message || 'Could not load' }));
			setPayload(null);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (saleIdParam || orderIdParam) {
			void loadSource();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const selectedLines = useMemo(() => {
		if (!payload?.lines) return [];
		return payload.lines
			.map((line: any) => {
				const key = line.sale_detail_id || line.order_item_id;
				const q = Number(String(qtys[key] || '').replace(/,/g, ''));
				if (!Number.isFinite(q) || q <= 0) return null;
				return {
					...line,
					key,
					return_qty: Math.min(q, Number(line.returnable_qty) || 0),
					restock: restockMap[key] !== false
				};
			})
			.filter(Boolean);
	}, [payload, qtys, restockMap]);

	const goodsValue = useMemo(
		() =>
			Math.round(
				selectedLines.reduce(
					(s: number, l: any) => s + l.return_qty * Number(l.unit_price || 0),
					0
				) * 100
			) / 100,
		[selectedLines]
	);

	useEffect(() => {
		if (goodsValue > 0) setRefundAmount(goodsValue.toFixed(2));
	}, [goodsValue]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedLines.length) {
			dispatch(showMessage({ message: 'Select at least one line quantity' }));
			return;
		}
		if (!reason) {
			dispatch(showMessage({ message: 'Select a reason' }));
			return;
		}
		try {
			const amt = Number(String(refundAmount || goodsValue).replace(/,/g, ''));
			await createReturn({
				...(sourceType === 'sale' ? { sale_id: sourceId.trim() } : { order_id: sourceId.trim() }),
				reason,
				notes: notes.trim() || undefined,
				refund_method: refundMethod,
				refund_amount: Number.isFinite(amt) ? amt : goodsValue,
				details: selectedLines.map((l: any) => ({
					...(sourceType === 'sale'
						? { sale_detail_id: l.sale_detail_id }
						: { order_item_id: l.order_item_id }),
					quantity: l.return_qty,
					unit_price: l.unit_price,
					restock: l.restock,
					reason,
					write_off_reason: l.restock ? undefined : reason
				}))
			}).unwrap();
			dispatch(showMessage({ message: 'Return recorded' }));
			router.push('/trading/sales/returns');
		} catch (err: any) {
			dispatch(showMessage({ message: err?.data?.message || err?.message || 'Failed' }));
		}
	};

	return (
		<>
			<GlobalStyles styles={() => ({ '#root': { maxHeight: '100vh' } })} />
			<div className="w-full h-full flex flex-col px-4">
				<NewReturnHeader />
				<div className="w-full flex justify-center pb-10">
					<Paper className="p-6 shadow-sm rounded-xl max-w-2xl w-full">
						<form onSubmit={handleSubmit} className="flex flex-col gap-4">
							<div className="flex gap-2">
								<TextField
									select
									label="Source"
									value={sourceType}
									onChange={(e) => setSourceType(e.target.value as 'sale' | 'order')}
									sx={{ minWidth: 120 }}
								>
									<MenuItem value="sale">Sale</MenuItem>
									<MenuItem value="order">Order</MenuItem>
								</TextField>
								<TextField
									label={sourceType === 'sale' ? 'Sale ID' : 'Order ID'}
									value={sourceId}
									onChange={(e) => setSourceId(e.target.value)}
									fullWidth
								/>
								<Button type="button" variant="outlined" onClick={loadSource} disabled={loading}>
									Load
								</Button>
							</div>

							{payload?.lines?.map((line: any) => {
								const key = line.sale_detail_id || line.order_item_id;
								const disabled = Number(line.returnable_qty) <= 0;
								return (
									<div key={key} className="flex items-center gap-3 border rounded-md p-3">
										<div className="flex-1 min-w-0">
											<Typography className="font-medium truncate">{line.product_name}</Typography>
											<Typography variant="caption" color="text.secondary">
												{formatGhsCurrency(Number(line.unit_price) || 0, 2, 2)} · returnable{' '}
												{line.returnable_qty}
											</Typography>
										</div>
										<TextField
											size="small"
											label="Qty"
											type="number"
											disabled={disabled}
											value={qtys[key] || ''}
											onChange={(e) => setQtys((p) => ({ ...p, [key]: e.target.value }))}
											sx={{ width: 90 }}
										/>
										<FormControlLabel
											control={
												<Switch
													disabled={disabled}
													checked={restockMap[key] !== false}
													onChange={(e) =>
														setRestockMap((p) => ({ ...p, [key]: e.target.checked }))
													}
												/>
											}
											label="Restock"
										/>
									</div>
								);
							})}

							<TextField
								select
								label="Reason"
								value={reason}
								onChange={(e) => setReason(e.target.value)}
								fullWidth
							>
								{REASONS.map((r) => (
									<MenuItem key={r} value={r}>
										{r}
									</MenuItem>
								))}
							</TextField>

							<TextField
								select
								label="Refund method"
								value={refundMethod}
								onChange={(e) => setRefundMethod(e.target.value)}
								fullWidth
							>
								<MenuItem value="cash">Cash</MenuItem>
								<MenuItem value="store_credit">Store credit</MenuItem>
								<MenuItem value="momo" disabled={!payload?.can_momo_refund}>
									MoMo {payload?.can_momo_refund ? '' : '(unavailable)'}
								</MenuItem>
							</TextField>

							<TextField
								label="Refund amount"
								type="number"
								value={refundAmount}
								onChange={(e) => setRefundAmount(e.target.value)}
								helperText={`Goods value ${formatGhsCurrency(goodsValue, 2, 2)}`}
								fullWidth
							/>

							<TextField
								label="Notes"
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								fullWidth
								multiline
								minRows={2}
							/>

							<div className="flex gap-2 justify-end">
								<Button type="button" variant="outlined" onClick={() => router.push('/trading/sales/returns')}>
									Cancel
								</Button>
								<Button type="submit" variant="contained" disabled={submitting || !payload}>
									{submitting ? 'Saving…' : 'Confirm return'}
								</Button>
							</div>
						</form>
					</Paper>
				</div>
			</div>
		</>
	);
}
