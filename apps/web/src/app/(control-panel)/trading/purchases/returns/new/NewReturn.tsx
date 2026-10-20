'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import MenuItem from '@mui/material/MenuItem';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import NewReturnHeader from './NewReturnHeader';
import {
	useGetPurchasesQuery,
	useLazyGetPurchaseReturnableQuery,
	useCreatePurchaseReturnMutation
} from '../../../TradingApi';
import { showMessage } from '@fuse/core/FuseMessage/fuseMessageSlice';
import { useAppDispatch } from 'src/store/hooks';
import { formatGhsCurrency } from '../../../../dashboards/analytics/daily-sales/formatGhsCurrency';

const REASONS = ['Damaged', 'Expired', 'Wrong item', 'Excess quantity', 'Poor quality', 'Other'];

type PurchaseOption = { id: string; label: string };

export default function NewReturn() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const purchaseIdParam = searchParams.get('purchaseId');
	const dispatch = useAppDispatch();

	const { data: purchases, isLoading: loadingPurchases } = useGetPurchasesQuery(undefined);
	const [fetchReturnable, { isFetching: loadingLines }] = useLazyGetPurchaseReturnableQuery();
	const [createPurchaseReturn, { isLoading: submitting }] = useCreatePurchaseReturnMutation();

	const [purchaseId, setPurchaseId] = useState<string | null>(purchaseIdParam);
	const [payload, setPayload] = useState<any>(null);
	const [qtys, setQtys] = useState<Record<string, string>>({});
	const [reason, setReason] = useState('');
	const [notes, setNotes] = useState('');

	const options: PurchaseOption[] = useMemo(
		() =>
			(Array.isArray(purchases) ? purchases : []).map((p: any) => ({
				id: p.id,
				label: [p.invoice_number || p.id, p.supplier, p.created_at ? new Date(p.created_at).toLocaleDateString() : null]
					.filter(Boolean)
					.join(' · ')
			})),
		[purchases]
	);
	const selectedOption = options.find((o) => o.id === purchaseId) || null;

	useEffect(() => {
		if (!purchaseId) {
			setPayload(null);
			return;
		}
		let active = true;
		fetchReturnable(purchaseId)
			.unwrap()
			.then((res) => {
				if (!active) return;
				setPayload(res);
				setQtys({});
			})
			.catch((err: any) => {
				if (!active) return;
				setPayload(null);
				dispatch(showMessage({ message: err?.data?.message || 'Could not load purchase' }));
			});
		return () => {
			active = false;
		};
	}, [purchaseId, fetchReturnable, dispatch]);

	const selectedLines = useMemo(() => {
		if (!payload?.lines) return [];
		return payload.lines
			.map((line: any) => {
				const q = Number(String(qtys[line.purchase_detail_id] || '').replace(/,/g, ''));
				if (!Number.isFinite(q) || q <= 0) return null;
				return { ...line, return_qty: q };
			})
			.filter(Boolean);
	}, [payload, qtys]);

	const overLimit = selectedLines.some((l: any) => l.return_qty > Number(l.returnable_qty));

	const goodsValue = useMemo(
		() =>
			Math.round(selectedLines.reduce((s: number, l: any) => s + l.return_qty * Number(l.unit_price || 0), 0) * 100) /
			100,
		[selectedLines]
	);

	const settlement = useMemo(() => {
		const p = payload?.purchase;
		if (!p || goodsValue <= 0) return null;
		const total = Number(p.total_amount) || 0;
		const discount = Number(p.discount_amount) || 0;
		const newTotal = Math.max(0, total - goodsValue);
		const newDiscount = total > 0 ? (discount * newTotal) / total : 0;
		const newNet = Math.max(0, newTotal - newDiscount);
		const credit = Math.max(0, (Number(p.net_total) || 0) - newNet);
		const cashBack = Math.max(0, (Number(p.amount_paid) || 0) - newNet);
		return { credit, cashBack, offOwed: Math.max(0, credit - cashBack) };
	}, [payload, goodsValue]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!purchaseId || !selectedLines.length) {
			dispatch(showMessage({ message: 'Enter a quantity for at least one item' }));
			return;
		}
		if (overLimit) {
			dispatch(showMessage({ message: 'A quantity is more than can be returned' }));
			return;
		}
		if (!reason) {
			dispatch(showMessage({ message: 'Select a reason' }));
			return;
		}
		try {
			const created = await createPurchaseReturn({
				purchase_id: purchaseId,
				reason,
				notes: notes.trim() || undefined,
				details: selectedLines.map((l: any) => ({
					purchase_detail_id: l.purchase_detail_id,
					quantity: l.return_qty,
					reason
				}))
			}).unwrap();
			dispatch(showMessage({ message: 'Purchase return recorded' }));
			router.push(created?.id ? `/trading/purchases/returns/${created.id}` : '/trading/purchases/returns');
		} catch (err: any) {
			dispatch(showMessage({ message: err?.data?.message || err?.message || 'Failed' }));
		}
	};

	const p = payload?.purchase;

	return (
		<>
			<GlobalStyles styles={() => ({ '#root': { maxHeight: '100vh' } })} />
			<div className="w-full h-full flex flex-col px-4">
				<NewReturnHeader />
				<div className="w-full flex justify-center pb-10">
					<Paper className="p-6 shadow-sm rounded-xl max-w-2xl w-full">
						<form onSubmit={handleSubmit} className="flex flex-col gap-4">
							<Autocomplete
								options={options}
								loading={loadingPurchases}
								value={selectedOption}
								onChange={(_, value) => setPurchaseId(value?.id ?? null)}
								isOptionEqualToValue={(a, b) => a.id === b.id}
								renderInput={(params) => (
									<TextField {...params} label="Purchase" placeholder="Search by invoice or supplier" />
								)}
								fullWidth
							/>

							{p && (
								<Typography variant="body2" color="text.secondary">
									{p.supplier_name || 'No supplier'} · {p.warehouse_name || 'Store'} · Total{' '}
									{formatGhsCurrency(Number(p.net_total) || 0, 2, 2)} · Paid{' '}
									{formatGhsCurrency(Number(p.amount_paid) || 0, 2, 2)} · Owed{' '}
									{formatGhsCurrency(Number(p.balance_owed) || 0, 2, 2)}
								</Typography>
							)}

							{loadingLines && <Typography color="text.secondary">Loading items…</Typography>}

							{payload?.lines?.map((line: any) => {
								const key = line.purchase_detail_id;
								const max = Number(line.returnable_qty) || 0;
								const q = Number(qtys[key] || 0);
								return (
									<div key={key} className="flex items-center gap-3 border rounded-md p-3">
										<div className="flex-1 min-w-0">
											<Typography className="font-medium truncate">{line.product_name}</Typography>
											<Typography variant="caption" color="text.secondary">
												{formatGhsCurrency(Number(line.unit_price) || 0, 2, 2)} each · bought{' '}
												{line.quantity_purchased}
												{line.quantity_returned > 0 ? ` · ${line.quantity_returned} returned` : ''} · {line.in_stock} in
												stock · can return {max}
											</Typography>
										</div>
										<TextField
											size="small"
											label="Qty"
											type="number"
											disabled={max <= 0}
											value={qtys[key] || ''}
											onChange={(e) => setQtys((prev) => ({ ...prev, [key]: e.target.value }))}
											error={q > max}
											inputProps={{ min: 0, max }}
											sx={{ width: 90 }}
										/>
									</div>
								);
							})}

							{payload && (
								<>
									<TextField select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} fullWidth>
										{REASONS.map((r) => (
											<MenuItem key={r} value={r}>
												{r}
											</MenuItem>
										))}
									</TextField>

									<TextField
										label="Notes"
										value={notes}
										onChange={(e) => setNotes(e.target.value)}
										fullWidth
										multiline
										minRows={2}
									/>

									{settlement && (
										<Typography variant="body2">
											Credit from supplier {formatGhsCurrency(settlement.credit, 2, 2)}
											{settlement.offOwed > 0.005 && ` · ${formatGhsCurrency(settlement.offOwed, 2, 2)} off amount owed`}
											{settlement.cashBack > 0.005 &&
												` · collect ${formatGhsCurrency(settlement.cashBack, 2, 2)} cash back from supplier`}
										</Typography>
									)}
								</>
							)}

							<div className="flex gap-2 justify-end pt-2">
								<Button type="button" variant="outlined" onClick={() => router.push('/trading/purchases/returns')}>
									Cancel
								</Button>
								<Button
									type="submit"
									variant="contained"
									color="primary"
									disabled={submitting || !payload || !selectedLines.length || overLimit}
								>
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
