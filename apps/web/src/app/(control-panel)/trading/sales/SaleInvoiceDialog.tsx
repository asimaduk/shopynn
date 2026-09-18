'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import toast from 'react-hot-toast';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import useUser from '@auth/useUser';
import {
	buildInvoiceFromSaleOrder,
	buildMailtoUrl,
	buildWhatsAppUrl,
	digitsOnlyPhone,
	downloadInvoicePdf,
	formatInvoiceText,
	shareInvoicePdfFile
} from '@/utils/saleInvoice';
import { useLazyGetSaleInvoicePdfQuery, useSendSaleInvoiceMutation } from '../TradingApi';
import { getPrintAgentPrintUrl } from '@/utils/printAgent';
import {
	normalizeWarehousePrinterType,
	type WarehousePrinterType
} from '../../setups/warehouses/models/WarehouseModel';
import InvoiceDocument, {
	INVOICE_PRINT_STYLES,
	wrapInvoicePrintDocument
} from './InvoiceDocument';

export type InvoicePrintNotice = {
	severity: 'success' | 'error' | 'info' | 'warning';
	message: string;
};

type SaleInvoiceDialogProps = {
	open: boolean;
	onClose: () => void;
	order: Record<string, unknown> | null | undefined;
	/** When set, enables server PDF download and email-with-PDF attachment */
	saleId?: string;
	/** Store printer preference — thermal uses Shopynn Print agent */
	printerType?: WarehousePrinterType | string | null;
	/** When true and printer is thermal, send to print agent once on open */
	autoPrintThermal?: boolean;
};

export default function SaleInvoiceDialog({
	open,
	onClose,
	order,
	saleId,
	printerType,
	autoPrintThermal = false
}: SaleInvoiceDialogProps) {
	const { data: user } = useUser();
	const printRef = useRef<HTMLDivElement>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [printNotice, setPrintNotice] = useState<InvoicePrintNotice | null>(null);
	const autoPrintKeyRef = useRef<string | null>(null);
	const [sendSaleInvoice] = useSendSaleInvoiceMutation();
	const [fetchSaleInvoicePdf] = useLazyGetSaleInvoicePdfQuery();
	const resolvedSaleId = saleId || (order?.id != null ? String(order.id) : undefined);
	const resolvedPrinterType = normalizeWarehousePrinterType(printerType);

	const invoice = useMemo(() => {
		if (!order) return null;
		const company = user?.company;
		return buildInvoiceFromSaleOrder(order, {
			name: company?.name || 'Shopynn',
			address: company?.address || '',
			phone: company?.phone || '',
			email: company?.email || ''
		});
	}, [order, user]);

	const canEmailPdf = Boolean(resolvedSaleId && invoice?.customer_email?.trim());
	const pdfFilename = `invoice-${String(invoice?.invoice_number || 'sale').replace(/[^\w.-]+/g, '_')}.pdf`;

	useEffect(() => {
		if (!open) {
			setPrintNotice(null);
			setBusy(null);
			autoPrintKeyRef.current = null;
		}
	}, [open]);

	const handleThermalPrint = useCallback(async () => {
		if (!order) return;
		const printUrl = getPrintAgentPrintUrl();
		if (!printUrl) {
			setPrintNotice({
				severity: 'error',
				message: 'Print agent not set. Configure it under Settings → Invoice & Receipt.'
			});
			return;
		}
		setBusy('thermal');
		setPrintNotice({ severity: 'info', message: 'Sending to thermal printer…' });
		try {
			const res = await fetch(printUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(order)
			});
			const data = await res.json().catch(() => ({}));
			if (data?.status == 200 || res.ok) {
				setPrintNotice({ severity: 'success', message: 'Print successful' });
			} else {
				setPrintNotice({
					severity: 'error',
					message: `Thermal print failed: ${data?.message || res.statusText || 'Check Print agent settings.'}`
				});
			}
		} catch (err) {
			setPrintNotice({
				severity: 'error',
				message: `Thermal print failed: ${(err as Error)?.message || 'Check Print agent settings.'}`
			});
		} finally {
			setBusy(null);
		}
	}, [order]);

	useEffect(() => {
		if (!open || !autoPrintThermal || resolvedPrinterType !== 'thermal' || !order) return;
		const key = String(order.id || order.invoice_number || 'sale');
		if (autoPrintKeyRef.current === key) return;
		autoPrintKeyRef.current = key;
		void handleThermalPrint();
	}, [open, autoPrintThermal, resolvedPrinterType, order, handleThermalPrint]);

	const handleBrowserPrint = () => {
		const el = printRef.current;
		if (!el || !invoice) return;

		// Use a hidden iframe — `window.open(..., 'noopener')` cannot write document content
		// (blank tab), and closing the print window too early also fails on Safari/Chrome.
		const iframe = document.createElement('iframe');
		iframe.setAttribute('title', 'Invoice print');
		iframe.style.cssText =
			'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
		document.body.appendChild(iframe);

		const win = iframe.contentWindow;
		const doc = win?.document;
		if (!win || !doc) {
			iframe.remove();
			setPrintNotice({ severity: 'error', message: 'Could not open print preview.' });
			return;
		}

		const title = String(invoice.invoice_number).replace(/</g, '');
		doc.open();
		doc.write(wrapInvoicePrintDocument(title, el.innerHTML));
		doc.close();

		const cleanup = () => {
			try {
				iframe.remove();
			} catch {
				/* ignore */
			}
		};

		win.addEventListener('afterprint', cleanup);
		// Give the iframe a moment to layout images/fonts, then print.
		window.setTimeout(() => {
			try {
				win.focus();
				win.print();
				setPrintNotice({ severity: 'success', message: 'Print dialog opened' });
			} catch {
				setPrintNotice({ severity: 'error', message: 'Print failed. Try Download PDF instead.' });
				cleanup();
			}
			// Fallback cleanup if afterprint never fires (some browsers).
			window.setTimeout(cleanup, 60_000);
		}, 300);
	};

	const handlePrint = () => {
		if (resolvedPrinterType === 'thermal') {
			void handleThermalPrint();
			return;
		}
		handleBrowserPrint();
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
			<DialogTitle sx={{ pr: printNotice ? { xs: 2, sm: 2 } : undefined }}>
				<Stack
					direction="row"
					alignItems="flex-start"
					justifyContent="space-between"
					spacing={1.5}
					useFlexGap
					sx={{ gap: 1.5 }}
				>
					<Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
						<span>Send invoice</span>
						{resolvedPrinterType === 'thermal' ? (
							<Chip
								size="small"
								variant="outlined"
								icon={<FuseSvgIcon size={14}>heroicons-outline:printer</FuseSvgIcon>}
								label="Printer: Thermal"
								sx={{
									fontWeight: 600,
									borderColor: 'grey.400',
									color: 'text.secondary',
									bgcolor: 'transparent',
									'& .MuiChip-icon': { color: 'text.secondary' }
								}}
							/>
						) : resolvedPrinterType === 'a4' ? (
							<Chip
								size="small"
								variant="outlined"
								icon={<FuseSvgIcon size={14}>heroicons-outline:document-text</FuseSvgIcon>}
								label="Printer: A4"
								sx={{
									fontWeight: 600,
									borderColor: 'grey.400',
									color: 'text.secondary',
									bgcolor: 'transparent',
									'& .MuiChip-icon': { color: 'text.secondary' }
								}}
							/>
						) : null}
					</Stack>
					{printNotice ? (
						<Alert
							severity={printNotice.severity}
							variant="filled"
							onClose={() => setPrintNotice(null)}
							sx={{
								py: 0.25,
								px: 1.25,
								alignItems: 'center',
								maxWidth: { xs: '100%', sm: 340 },
								flexShrink: 0,
								'& .MuiAlert-message': {
									fontSize: 13,
									fontWeight: 600,
									py: 0.5
								}
							}}
						>
							{printNotice.message}
						</Alert>
					) : null}
				</Stack>
			</DialogTitle>
			<DialogContent dividers>
				<Stack spacing={2} sx={{ mb: 2 }}>
					<Stack direction="row" flexWrap="wrap" gap={1}>
						{(
							[
								{
									key: 'download',
									label: 'Download PDF',
									busyKey: 'download',
									icon: 'heroicons-outline:arrow-down-tray',
									onClick: () => runPdfAction('download'),
									show: true
								},
								{
									key: 'server-email',
									label: `Email PDF (${invoice.customer_email})`,
									busyKey: 'server-email',
									icon: 'heroicons-outline:paper-airplane',
									onClick: () => runPdfAction('server-email'),
									show: canEmailPdf
								},
								{
									key: 'email',
									label: 'Email (device)',
									busyKey: 'email',
									icon: 'heroicons-outline:envelope',
									onClick: () => runPdfAction('email'),
									show: true
								},
								{
									key: 'whatsapp',
									label: 'WhatsApp',
									busyKey: 'whatsapp',
									icon: 'heroicons-outline:chat-bubble-left-right',
									onClick: () => runPdfAction('whatsapp'),
									show: true
								},
								{
									key: 'print-thermal',
									label: 'Print receipt',
									busyKey: 'thermal',
									icon: 'heroicons-outline:printer',
									onClick: handlePrint,
									show: resolvedPrinterType === 'thermal'
								},
								{
									key: 'print',
									label: 'Print',
									busyKey: 'print',
									icon: 'heroicons-outline:printer',
									onClick: handlePrint,
									show: resolvedPrinterType !== 'thermal'
								},
								{
									key: 'print-browser',
									label: 'Print (browser)',
									busyKey: 'print-browser',
									icon: 'heroicons-outline:document-text',
									onClick: handleBrowserPrint,
									show: resolvedPrinterType === 'thermal'
								}
							] as const
						)
							.filter((b) => b.show)
							.map((b) => (
								<Button
									key={b.key}
									variant="outlined"
									color="inherit"
									disabled={!!busy}
									onClick={b.onClick}
									startIcon={
										busy === b.busyKey ? (
											<CircularProgress size={16} color="inherit" />
										) : (
											<FuseSvgIcon size={18}>{b.icon}</FuseSvgIcon>
										)
									}
									sx={{
										borderRadius: '5px',
										borderColor: 'grey.400',
										color: 'text.primary',
										bgcolor: 'background.paper',
										textTransform: 'none',
										fontWeight: 600,
										px: 1.5,
										'&:hover': {
											borderColor: 'grey.600',
											bgcolor: 'action.hover'
										}
									}}
								>
									{b.label}
								</Button>
							))}
					</Stack>
					{resolvedPrinterType === 'thermal' ? (
						<Stack
							direction="row"
							alignItems="flex-start"
							spacing={1}
							sx={(theme) => ({
								p: 1.25,
								borderRadius: '5px',
								bgcolor: theme.palette.mode === 'dark' ? 'rgba(46, 125, 50, 0.16)' : 'rgba(46, 125, 50, 0.08)',
								border: '1px solid',
								borderColor: 'success.light'
							})}
						>
							<FuseSvgIcon size={18} color="success">
								heroicons-outline:check-circle
							</FuseSvgIcon>
							<Typography variant="caption" color="text.secondary" sx={{ m: 0 }}>
								This store is set to <strong>thermal</strong>. “Print receipt” sends to the Shopynn Print
								agent. Use “Print (browser)” for a normal paper/PDF print.
								{/* {!canEmailPdf
									? ' Email PDF stays hidden until the sale has a customer email.'
									: ' Email PDF sends from the server with the invoice attached.'} */}
							</Typography>
						</Stack>
					) : (
						<Box component="p" sx={{ typography: 'caption', color: 'text.secondary', m: 0 }}>
							{canEmailPdf
								? 'Email PDF sends from the server with the invoice attached. '
								: 'Email PDF is hidden until the sale has a customer email. '}
							Print opens the browser print dialog. Download uses the server PDF when the sale is saved;
							otherwise a browser-generated PDF is used.
						</Box>
					)}
				</Stack>
				<Box
					sx={{
						maxHeight: '55vh',
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
			</DialogActions>
		</Dialog>
	);
}
