'use client';

import { useMemo, useRef } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Box from '@mui/material/Box';
import toast from 'react-hot-toast';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import type { SaleInvoice } from '@/utils/saleInvoice';
import InvoiceDocument, {
	INVOICE_PRINT_STYLES,
	wrapInvoicePrintDocument
} from '../sales/InvoiceDocument';

export type A4SaleReceiptPayload = {
	invoice_number: string;
	customer?: string | null;
	sale_date?: string;
	total_amount?: number;
	discount_amount?: number;
	products?: { name?: string; quantity?: number; unit_price?: number }[];
	notes?: string;
	cashier?: string;
	payment_type?: number | string;
	warehouse?: string;
	customer_email?: string;
	customer_phone?: string;
};

type A4ReceiptPreviewDialogProps = {
	open: boolean;
	onClose: () => void;
	payload: A4SaleReceiptPayload | null;
	storeName?: string;
	companyName?: string;
};

function toInvoice(payload: A4SaleReceiptPayload, storeName?: string, companyName?: string): SaleInvoice {
	const products = Array.isArray(payload.products) ? payload.products : [];
	const line_items = products.map((p) => {
		const quantity = Number(p.quantity) || 0;
		const unit_price = Number(p.unit_price) || 0;
		return {
			name: String(p.name || 'Item'),
			quantity,
			unit_price,
			line_total: quantity * unit_price
		};
	});
	const discount_amount = Number(payload.discount_amount) || 0;
	const computedSubtotal = line_items.reduce((s, r) => s + r.line_total, 0);
	const totalRaw = Number(payload.total_amount) || 0;
	const total_amount =
		Number.isFinite(totalRaw) && totalRaw > 0
			? totalRaw
			: Math.max(0, computedSubtotal - discount_amount);
	const subtotal = discount_amount > 0 ? total_amount + discount_amount : computedSubtotal || total_amount;
	const paymentType = payload.payment_type;
	const payment_method =
		paymentType === 2 || paymentType === 'momo' || paymentType === 'mobile_money'
			? 'Mobile Money'
			: paymentType === 'card' || paymentType === 3
				? 'Card'
				: 'Cash';

	return {
		invoice_number: String(payload.invoice_number || '—'),
		sale_date: String(payload.sale_date || new Date().toISOString()),
		customer_name: String(payload.customer || 'Walk-in'),
		customer_email: String(payload.customer_email || '').trim(),
		customer_phone: String(payload.customer_phone || '').trim(),
		payment_method,
		payment_reference: '',
		store_name: String(storeName || payload.warehouse || ''),
		cashier: String(payload.cashier || ''),
		notes: String(payload.notes || ''),
		currency: 'GH₵',
		company: {
			name: companyName || storeName || 'Shopynn',
			address: '',
			phone: '',
			email: ''
		},
		line_items,
		subtotal,
		discount_amount,
		total_amount
	};
}

export default function A4ReceiptPreviewDialog({
	open,
	onClose,
	payload,
	storeName,
	companyName
}: A4ReceiptPreviewDialogProps) {
	const printRef = useRef<HTMLDivElement>(null);
	const invoice = useMemo(
		() => (payload ? toInvoice(payload, storeName, companyName) : null),
		[payload, storeName, companyName]
	);

	const handlePrint = () => {
		const el = printRef.current;
		if (!el || !invoice) return;

		const iframe = document.createElement('iframe');
		iframe.setAttribute('title', 'Invoice print');
		iframe.style.cssText =
			'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
		document.body.appendChild(iframe);

		const win = iframe.contentWindow;
		const doc = win?.document;
		if (!win || !doc) {
			iframe.remove();
			toast.error('Could not open print preview.');
			return;
		}

		doc.open();
		doc.write(wrapInvoicePrintDocument(invoice.invoice_number, el.innerHTML));
		doc.close();

		const cleanup = () => {
			try {
				iframe.remove();
			} catch {
				/* ignore */
			}
		};

		win.addEventListener('afterprint', cleanup);
		window.setTimeout(() => {
			try {
				win.focus();
				win.print();
			} catch {
				toast.error('Print failed.');
				cleanup();
			}
			window.setTimeout(cleanup, 60_000);
		}, 300);
	};

	if (!invoice) return null;

	return (
		<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
			<DialogTitle>Invoice preview</DialogTitle>
			<DialogContent dividers>
				<Box
					sx={{
						maxHeight: '70vh',
						overflow: 'auto',
						bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'grey.900' : '#EEF2F7'),
						p: 2.5,
						borderRadius: 2
					}}
				>
					<style>{INVOICE_PRINT_STYLES}</style>
					<Box
						ref={printRef}
						sx={{
							bgcolor: '#fff',
							boxShadow: '0 12px 40px rgba(15, 23, 42, 0.12)',
							borderRadius: 1,
							p: { xs: 3, sm: 4.5 },
							maxWidth: 720,
							mx: 'auto',
							minHeight: 420,
							color: '#0F172A'
						}}
					>
						<InvoiceDocument invoice={invoice} />
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
