'use client';

import { useMemo, useRef, useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import toast from 'react-hot-toast';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import useUser from '@auth/useUser';
import {
	buildInvoiceFromSaleOrder,
	buildMailtoUrl,
	buildWhatsAppUrl,
	digitsOnlyPhone,
	downloadInvoicePdf,
	formatInvoiceDate,
	formatInvoiceText,
	formatMoney,
	shareInvoicePdfFile,
	type SaleInvoice
} from '@/utils/saleInvoice';
import { useLazyGetSaleInvoicePdfQuery, useSendSaleInvoiceMutation } from '../TradingApi';

type SaleInvoiceDialogProps = {
	open: boolean;
	onClose: () => void;
	order: Record<string, unknown> | null | undefined;
	/** When set, enables server PDF download and email-with-PDF attachment */
	saleId?: string;
};

function InvoicePreviewBody({ invoice }: { invoice: SaleInvoice }) {
	const cell = (border = '1px solid #ddd') =>
		({
			border,
			padding: '10px 12px'
		}) as const;

	return (
		<>
			<h1 style={{ fontSize: '1.35rem', margin: '0 0 4px', fontWeight: 700, color: '#0A74DA' }}>
				Invoice
			</h1>
			<p style={{ margin: '0 0 12px', fontWeight: 700 }}>{invoice.company.name}</p>
			<div className="meta" style={{ color: '#555', fontSize: '0.875rem', marginBottom: 20, lineHeight: 1.5 }}>
				{invoice.company.address ? <div>{invoice.company.address}</div> : null}
				{invoice.company.phone ? <div>Tel: {invoice.company.phone}</div> : null}
				{invoice.company.email ? <div>{invoice.company.email}</div> : null}
				<div>
					<strong>Invoice:</strong> {invoice.invoice_number}
				</div>
				<div>
					<strong>Date:</strong> {formatInvoiceDate(invoice.sale_date)}
				</div>
				<div>
					<strong>Customer:</strong> {invoice.customer_name}
				</div>
				<div>
					<strong>Payment:</strong> {invoice.payment_method}
				</div>
				{invoice.store_name ? (
					<div>
						<strong>Store:</strong> {invoice.store_name}
					</div>
				) : null}
				{invoice.cashier ? (
					<div>
						<strong>Cashier:</strong> {invoice.cashier}
					</div>
				) : null}
			</div>
			<table style={{ width: '100%', borderCollapse: 'collapse', margin: '16px 0', fontSize: '0.9rem' }}>
				<thead>
					<tr>
						<th style={{ ...cell(), background: '#0A74DA', color: '#fff', textAlign: 'left' }}>Item</th>
						<th style={{ ...cell(), background: '#0A74DA', color: '#fff', textAlign: 'right' }}>Qty</th>
						<th style={{ ...cell(), background: '#0A74DA', color: '#fff', textAlign: 'right' }}>Unit</th>
						<th style={{ ...cell(), background: '#0A74DA', color: '#fff', textAlign: 'right' }}>Amount</th>
					</tr>
				</thead>
				<tbody>
					{invoice.line_items.map((row, i) => (
						<tr key={i}>
							<td style={{ ...cell(), textAlign: 'left' }}>{row.name}</td>
							<td style={{ ...cell(), textAlign: 'right' }}>{row.quantity}</td>
							<td style={{ ...cell(), textAlign: 'right' }}>{formatMoney(row.unit_price, invoice.currency)}</td>
							<td style={{ ...cell(), textAlign: 'right' }}>{formatMoney(row.line_total, invoice.currency)}</td>
						</tr>
					))}
					{invoice.line_items.length === 0 ? (
						<tr>
							<td colSpan={4} style={cell()}>
								No line items
							</td>
						</tr>
					) : null}
				</tbody>
			</table>
			<div className="totals" style={{ marginTop: 12, maxWidth: 280, marginLeft: 'auto', fontSize: '0.95rem' }}>
				{invoice.discount_amount > 0 ? (
					<>
						<div className="row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
							<span>Subtotal</span>
							<span>{formatMoney(invoice.subtotal, invoice.currency)}</span>
						</div>
						<div className="row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
							<span>Discount</span>
							<span>{formatMoney(invoice.discount_amount, invoice.currency)}</span>
						</div>
					</>
				) : null}
				<div
					className="row grand"
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						fontWeight: 700,
						fontSize: '1.05rem',
						borderTop: '2px solid #111',
						marginTop: 8,
						paddingTop: 10
					}}
				>
					<span>Total</span>
					<span>{formatMoney(invoice.total_amount, invoice.currency)}</span>
				</div>
			</div>
			{invoice.notes ? (
				<p className="foot" style={{ marginTop: 24, fontSize: '0.85rem', color: '#666' }}>
					<strong>Notes:</strong> {invoice.notes}
				</p>
			) : null}
		</>
	);
}

export default function SaleInvoiceDialog({ open, onClose, order, saleId }: SaleInvoiceDialogProps) {
	const { data: user } = useUser();
	const printRef = useRef<HTMLDivElement>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [sendSaleInvoice] = useSendSaleInvoiceMutation();
	const [fetchSaleInvoicePdf] = useLazyGetSaleInvoicePdfQuery();
	const resolvedSaleId = saleId || (order?.id != null ? String(order.id) : undefined);

	const invoice = useMemo(() => {
		if (!order) return null;
		const company = (user as { company?: Record<string, string> })?.company;
		return buildInvoiceFromSaleOrder(order, {
			name: company?.name || (user as { companyName?: string })?.companyName || 'Shopynn',
			address: company?.address || '',
			phone: company?.phone || '',
			email: company?.email || ''
		});
	}, [order, user]);

	const pdfFilename = `invoice-${String(invoice?.invoice_number || 'sale').replace(/[^\w.-]+/g, '_')}.pdf`;

	const handlePrint = () => {
		const el = printRef.current;
		if (!el || !invoice) return;
		const w = window.open('', '_blank', 'noopener,noreferrer');
		if (!w) {
			toast.error('Pop-up blocked. Allow pop-ups to print.');
			return;
		}
		const title = String(invoice.invoice_number).replace(/</g, '');
		w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
			<style>
				body{font-family:system-ui,sans-serif;margin:0;padding:32px;color:#111;}
				.meta{color:#555;font-size:0.875rem;margin-bottom:20px;line-height:1.5;}
				table{width:100%;border-collapse:collapse;margin:16px 0;font-size:0.9rem;}
				th,td{border:1px solid #ddd;padding:10px 12px;}
				th{background:#0A74DA;color:#fff;}
				td.num,th.num{text-align:right;}
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

	const downloadServerPdf = async () => {
		if (!resolvedSaleId) return false;
		const blob = await fetchSaleInvoicePdf(resolvedSaleId).unwrap();
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = pdfFilename;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
		return true;
	};

	const runPdfAction = async (action: 'download' | 'email' | 'whatsapp' | 'share' | 'server-email') => {
		const el = printRef.current;
		if (!el || !invoice) return;
		setBusy(action);
		try {
			const text = formatInvoiceText(invoice);

			if (action === 'server-email') {
				if (!resolvedSaleId) {
					toast.error('Save the sale first to email from the server.');
					return;
				}
				const result = await sendSaleInvoice({
					saleId: resolvedSaleId,
					email: invoice.customer_email || undefined
				}).unwrap();
				toast.success(`Invoice sent to ${result.sent_to}`);
				return;
			}

			if (action === 'download') {
				if (resolvedSaleId) {
					try {
						await downloadServerPdf();
						toast.success('PDF downloaded');
						return;
					} catch {
						/* client render fallback */
					}
				}
				await downloadInvoicePdf(el, pdfFilename);
				toast.success('PDF downloaded');
				return;
			}

			if (action === 'email') {
				if (resolvedSaleId && invoice.customer_email) {
					try {
						const result = await sendSaleInvoice({
							saleId: resolvedSaleId,
							email: invoice.customer_email
						}).unwrap();
						toast.success(`Invoice emailed to ${result.sent_to}`);
						return;
					} catch {
						/* fall through */
					}
				}
				try {
					const result = await shareInvoicePdfFile(el, pdfFilename, text);
					if (result === 'shared') {
						toast.success('Shared PDF — pick your email app');
						return;
					}
				} catch {
					/* fall through to mailto */
				}
				const subject = `Invoice ${invoice.invoice_number}`;
				const body = `${text}\n\n(A PDF was downloaded — attach it to this email if needed.)`;
				window.location.href = buildMailtoUrl(invoice.customer_email, subject, body);
				return;
			}

			if (action === 'whatsapp') {
				const digits = digitsOnlyPhone(invoice.customer_phone);
				window.open(buildWhatsAppUrl(digits, text), '_blank', 'noopener,noreferrer');
				return;
			}

			if (action === 'share') {
				const result = await shareInvoicePdfFile(el, pdfFilename, text);
				toast.success(result === 'shared' ? 'Invoice shared' : 'PDF downloaded — share from your downloads folder');
			}
		} catch (err) {
			console.error(err);
			toast.error('Could not complete that action. Try Print or Download PDF.');
		} finally {
			setBusy(null);
		}
	};

	if (!invoice) return null;

	return (
		<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
			<DialogTitle>Send invoice</DialogTitle>
			<DialogContent dividers>
				<Stack spacing={2} sx={{ mb: 2 }}>
					<Stack direction="row" flexWrap="wrap" gap={1}>
						<Button
							variant="contained"
							color="primary"
							disabled={!!busy}
							onClick={() => runPdfAction('download')}
							startIcon={
								busy === 'download' ? (
									<CircularProgress size={16} color="inherit" />
								) : (
									<FuseSvgIcon size={18}>heroicons-outline:arrow-down-tray</FuseSvgIcon>
								)
							}
						>
							Download PDF
						</Button>
						{resolvedSaleId ? (
							<Button
								variant="contained"
								color="secondary"
								disabled={!!busy}
								onClick={() => runPdfAction('server-email')}
								startIcon={
									busy === 'server-email' ? (
										<CircularProgress size={16} color="inherit" />
									) : (
										<FuseSvgIcon size={18}>heroicons-outline:paper-airplane</FuseSvgIcon>
									)
								}
							>
								Email PDF
								{invoice.customer_email ? ` (${invoice.customer_email})` : ''}
							</Button>
						) : null}
						<Button
							variant="outlined"
							disabled={!!busy}
							onClick={() => runPdfAction('email')}
							startIcon={
								busy === 'email' ? (
									<CircularProgress size={16} />
								) : (
									<FuseSvgIcon size={18}>heroicons-outline:envelope</FuseSvgIcon>
								)
							}
						>
							Email (device)
						</Button>
						<Button
							variant="outlined"
							color="success"
							disabled={!!busy}
							onClick={() => runPdfAction('whatsapp')}
							startIcon={
								busy === 'whatsapp' ? (
									<CircularProgress size={16} color="inherit" />
								) : (
									<FuseSvgIcon size={18}>heroicons-outline:chat-bubble-left-right</FuseSvgIcon>
								)
							}
						>
							WhatsApp
						</Button>
						<Button
							variant="outlined"
							disabled={!!busy}
							onClick={handlePrint}
							startIcon={<FuseSvgIcon size={18}>heroicons-outline:printer</FuseSvgIcon>}
						>
							Print
						</Button>
					</Stack>
					<Box component="p" sx={{ typography: 'caption', color: 'text.secondary', m: 0 }}>
						Email PDF sends from the server with the invoice attached (requires customer email). Download uses the
						server PDF when the sale is saved; otherwise a browser-generated PDF is used.
					</Box>
				</Stack>
				<Box sx={{ maxHeight: '55vh', overflow: 'auto', bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
					<Box
						ref={printRef}
						sx={{
							bgcolor: 'background.paper',
							boxShadow: 2,
							p: 4,
							maxWidth: 720,
							mx: 'auto',
							minHeight: 320
						}}
					>
						<InvoicePreviewBody invoice={invoice} />
					</Box>
				</Box>
			</DialogContent>
			<DialogActions sx={{ px: 3, py: 2 }}>
				<Button onClick={onClose} color="inherit">
					Close
				</Button>
			</DialogActions>
		</Dialog>
	);
}
