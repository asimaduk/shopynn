'use client';

import { useRef } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Box from '@mui/material/Box';
import toast from 'react-hot-toast';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';

export type A4SaleReceiptPayload = {
	invoice_number: string;
	customer?: string | null;
	sale_date?: string;
	total_amount?: number;
	discount_amount?: number;
	products?: { name?: string; quantity?: number; unit_price?: number }[];
	notes?: string;
	cashier?: string;
};

type A4ReceiptPreviewDialogProps = {
	open: boolean;
	onClose: () => void;
	payload: A4SaleReceiptPayload | null;
	storeName?: string;
};

function formatMoney(n: number | undefined) {
	const v = Number(n);
	if (!Number.isFinite(v)) return '0.00';
	return v.toFixed(2);
}

function formatDate(iso?: string) {
	if (!iso) return '—';
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

export default function A4ReceiptPreviewDialog({
	open,
	onClose,
	payload,
	storeName
}: A4ReceiptPreviewDialogProps) {
	const printRef = useRef<HTMLDivElement>(null);

	const handlePrint = () => {
		const el = printRef.current;
		if (!el || !payload) return;
		const w = window.open('', '_blank', 'noopener,noreferrer');
		if (!w) {
			toast.error('Pop-up blocked. Allow pop-ups to print.');
			return;
		}
		const title = String(payload.invoice_number ?? 'Receipt').replace(/</g, '');
		w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
			<style>
				body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:32px;color:#111;}
				h1{font-size:1.35rem;margin:0 0 4px;font-weight:700;}
				.meta{color:#555;font-size:0.875rem;margin-bottom:20px;line-height:1.5;}
				table{width:100%;border-collapse:collapse;margin:16px 0;font-size:0.9rem;}
				th,td{border:1px solid #ddd;padding:10px 12px;}
				th{background:#f4f4f5;text-align:left;font-weight:600;}
				td.num{text-align:right;}
				.totals{margin-top:12px;max-width:280px;margin-left:auto;font-size:0.95rem;}
				.totals .row{display:flex;justify-content:space-between;padding:4px 0;}
				.totals .grand{font-weight:700;font-size:1.05rem;border-top:2px solid #111;margin-top:8px;padding-top:10px;}
				.foot{margin-top:24px;font-size:0.85rem;color:#666;}
			</style></head><body>${el.innerHTML}</body></html>`);
		w.document.close();
		w.focus();
		requestAnimationFrame(() => {
			try {
				w.print();
			} finally {
				w.close();
			}
		});
	};

	if (!payload) return null;

	const products = Array.isArray(payload.products) ? payload.products : [];
	const discount = Number(payload.discount_amount || 0);
	const total = Number(payload.total_amount || 0);
	const subtotal = total + discount;

	const cell = (border = '1px solid #ddd') => ({
		border,
		padding: '10px 12px'
	} as const);

	return (
		<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
			<DialogTitle>Invoice preview</DialogTitle>
			<DialogContent dividers>
				<Box sx={{ maxHeight: '70vh', overflow: 'auto', bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
					<Box
						ref={printRef}
						sx={{
							bgcolor: 'background.paper',
							boxShadow: 2,
							p: 4,
							maxWidth: 720,
							mx: 'auto',
							minHeight: 360
						}}
					>
						<h1 style={{ fontSize: '1.35rem', margin: '0 0 4px', fontWeight: 700 }}>Sales receipt</h1>
						<div className="meta">
							{storeName ? (
								<div>
									<strong>Store:</strong> {storeName}
								</div>
							) : null}
							<div>
								<strong>Invoice:</strong> {payload.invoice_number}
							</div>
							<div>
								<strong>Date:</strong> {formatDate(payload.sale_date)}
							</div>
							<div>
								<strong>Customer:</strong> {payload.customer || 'Walk In'}
							</div>
							{payload.cashier ? (
								<div>
									<strong>Cashier:</strong> {payload.cashier}
								</div>
							) : null}
						</div>
						<table style={{ width: '100%', borderCollapse: 'collapse', margin: '16px 0', fontSize: '0.9rem' }}>
							<thead>
								<tr>
									<th style={{ ...cell(), background: '#f4f4f5', textAlign: 'left' }}>Item</th>
									<th style={{ ...cell(), background: '#f4f4f5', textAlign: 'right' }}>Qty</th>
									<th style={{ ...cell(), background: '#f4f4f5', textAlign: 'right' }}>Unit</th>
									<th style={{ ...cell(), background: '#f4f4f5', textAlign: 'right' }}>Amount</th>
								</tr>
							</thead>
							<tbody>
								{products.map((p, i) => {
									const q = Number(p.quantity) || 0;
									const u = Number(p.unit_price) || 0;
									const line = q * u;
									return (
										<tr key={i}>
											<td style={{ ...cell(), textAlign: 'left' }}>{p.name ?? 'Item'}</td>
											<td style={{ ...cell(), textAlign: 'right' }}>{q}</td>
											<td style={{ ...cell(), textAlign: 'right' }}>₵ {formatMoney(u)}</td>
											<td style={{ ...cell(), textAlign: 'right' }}>₵ {formatMoney(line)}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
						<div className="totals">
							{discount > 0 ? (
								<>
									<div className="row">
										<span>Subtotal</span>
										<span>₵ {formatMoney(subtotal)}</span>
									</div>
									<div className="row">
										<span>Discount</span>
										<span>₵ {formatMoney(discount)}</span>
									</div>
								</>
							) : null}
							<div className="row grand">
								<span>Total</span>
								<span>₵ {formatMoney(total)}</span>
							</div>
						</div>
						{payload.notes ? (
							<div className="foot">
								<strong>Notes:</strong> {payload.notes}
							</div>
						) : null}
					</Box>
				</Box>
			</DialogContent>
			<DialogActions sx={{ px: 3, py: 2 }}>
				<Button onClick={onClose} color="inherit">
					Close
				</Button>
				<Button
					variant="contained"
					color="secondary"
					onClick={handlePrint}
					startIcon={<FuseSvgIcon size={18}>heroicons-outline:printer</FuseSvgIcon>}
				>
					Print
				</Button>
			</DialogActions>
		</Dialog>
	);
}
