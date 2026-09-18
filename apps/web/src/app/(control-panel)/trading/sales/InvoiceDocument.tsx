'use client';

import type { CSSProperties } from 'react';
import { formatInvoiceDate, formatMoney, type SaleInvoice } from '@/utils/saleInvoice';

/** Shopynn invoice brand accent — used sparingly on A4 layouts. */
export const INVOICE_ACCENT = '#0A74DA';

const ink = '#0F172A';
const muted = '#64748B';
const line = '#E2E8F0';
const soft = '#F8FAFC';

/** Shared print/PDF stylesheet for iframe print + html2canvas. */
export const INVOICE_PRINT_STYLES = `
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 0;
  color: ${ink};
  background: #fff;
  font-family: "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.inv-root { width: 100%; max-width: 190mm; margin: 0 auto; }
.inv-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
.inv-brand-name {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: ${ink};
  line-height: 1.2;
}
.inv-brand-meta { margin-top: 8px; font-size: 11.5px; color: ${muted}; line-height: 1.55; }
.inv-badge-wrap { text-align: right; flex-shrink: 0; }
.inv-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${INVOICE_ACCENT};
  margin: 0 0 6px;
}
.inv-number { margin: 0; font-size: 18px; font-weight: 700; color: ${ink}; letter-spacing: -0.01em; }
.inv-date { margin: 6px 0 0; font-size: 12px; color: ${muted}; }
.inv-rule {
  height: 3px;
  margin: 22px 0 20px;
  border: 0;
  background: linear-gradient(90deg, ${INVOICE_ACCENT} 0%, ${INVOICE_ACCENT} 42%, ${line} 42%, ${line} 100%);
}
.inv-meta { display: flex; justify-content: space-between; gap: 32px; margin-bottom: 28px; }
.inv-meta-col { flex: 1; min-width: 0; }
.inv-meta-col.right { text-align: right; }
.inv-label {
  margin: 0 0 8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${muted};
}
.inv-customer { margin: 0; font-size: 14px; font-weight: 700; color: ${ink}; }
.inv-customer-sub { margin: 4px 0 0; font-size: 12px; color: ${muted}; line-height: 1.5; }
.inv-detail-row { font-size: 12px; color: ${ink}; line-height: 1.65; }
.inv-detail-row span { color: ${muted}; }
.inv-table { width: 100%; border-collapse: collapse; margin: 0 0 8px; }
.inv-table thead th {
  padding: 10px 12px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${muted};
  background: ${soft};
  border-top: 1px solid ${line};
  border-bottom: 1px solid ${line};
  text-align: left;
}
.inv-table thead th.num { text-align: right; }
.inv-table tbody td {
  padding: 12px;
  font-size: 12.5px;
  color: ${ink};
  border-bottom: 1px solid ${line};
  vertical-align: top;
}
.inv-table tbody td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.inv-table tbody td.muted { color: ${muted}; }
.inv-empty { padding: 20px 12px; text-align: center; color: ${muted}; font-size: 12px; }
.inv-totals-wrap { display: flex; justify-content: flex-end; margin-top: 8px; }
.inv-totals { width: 240px; }
.inv-total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 12.5px;
  color: ${muted};
}
.inv-total-row span:last-child { color: ${ink}; font-variant-numeric: tabular-nums; }
.inv-due {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding: 12px 14px;
  background: ${INVOICE_ACCENT};
  color: #fff;
  border-radius: 6px;
  font-weight: 700;
  font-size: 13px;
}
.inv-due .amount { font-size: 16px; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.inv-cash-settle { margin-top: 10px; padding-top: 8px; border-top: 1px dashed ${line}; }
.inv-notes {
  margin-top: 28px;
  padding: 12px 14px;
  background: ${soft};
  border-left: 3px solid ${INVOICE_ACCENT};
  border-radius: 0 6px 6px 0;
}
.inv-notes-label {
  margin: 0 0 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${muted};
}
.inv-notes-body { margin: 0; font-size: 12px; color: ${ink}; line-height: 1.5; }
.inv-footer {
  margin-top: 36px;
  padding-top: 16px;
  border-top: 1px solid ${line};
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
}
.inv-thanks { margin: 0; font-size: 13px; font-weight: 600; color: ${ink}; }
.inv-powered { margin: 4px 0 0; font-size: 10px; color: ${muted}; }
.inv-footer-right { text-align: right; font-size: 10px; color: ${muted}; line-height: 1.5; }
`;

type InvoiceDocumentProps = {
	invoice: SaleInvoice;
	/** Extra class on root for print targeting */
	className?: string;
	style?: CSSProperties;
};

export default function InvoiceDocument({ invoice, className, style }: InvoiceDocumentProps) {
	const contactBits = [invoice.customer_phone, invoice.customer_email].filter(Boolean);

	return (
		<div className={`inv-root${className ? ` ${className}` : ''}`} style={style}>
			<header className="inv-header">
				<div>
					<h1 className="inv-brand-name">{invoice.company.name}</h1>
					<div className="inv-brand-meta">
						{invoice.company.address ? <div>{invoice.company.address}</div> : null}
						{invoice.company.phone ? <div>{invoice.company.phone}</div> : null}
						{invoice.company.email ? <div>{invoice.company.email}</div> : null}
					</div>
				</div>
				<div className="inv-badge-wrap">
					<p className="inv-badge">Invoice</p>
					<p className="inv-number">{invoice.invoice_number}</p>
					<p className="inv-date">{formatInvoiceDate(invoice.sale_date)}</p>
				</div>
			</header>

			<hr className="inv-rule" />

			<section className="inv-meta">
				<div className="inv-meta-col">
					<p className="inv-label">Bill to</p>
					<p className="inv-customer">{invoice.customer_name}</p>
					{contactBits.length > 0 ? (
						<p className="inv-customer-sub">{contactBits.join(' · ')}</p>
					) : null}
				</div>
				<div className="inv-meta-col right">
					<p className="inv-label">Details</p>
					<div className="inv-detail-row">
						<span>Payment · </span>
						{invoice.payment_method}
						{invoice.payment_reference ? ` (${invoice.payment_reference})` : ''}
					</div>
					{invoice.store_name ? (
						<div className="inv-detail-row">
							<span>Store · </span>
							{invoice.store_name}
						</div>
					) : null}
					{invoice.cashier ? (
						<div className="inv-detail-row">
							<span>Cashier · </span>
							{invoice.cashier}
						</div>
					) : null}
				</div>
			</section>

			<table className="inv-table">
				<thead>
					<tr>
						<th style={{ width: '46%' }}>Description</th>
						<th className="num" style={{ width: '14%' }}>
							Qty
						</th>
						<th className="num" style={{ width: '20%' }}>
							Unit price
						</th>
						<th className="num" style={{ width: '20%' }}>
							Amount
						</th>
					</tr>
				</thead>
				<tbody>
					{invoice.line_items.length === 0 ? (
						<tr>
							<td colSpan={4} className="inv-empty">
								No line items
							</td>
						</tr>
					) : (
						invoice.line_items.map((row, i) => (
							<tr key={i}>
								<td>{row.name}</td>
								<td className="num muted">{row.quantity}</td>
								<td className="num muted">{formatMoney(row.unit_price, invoice.currency)}</td>
								<td className="num">{formatMoney(row.line_total, invoice.currency)}</td>
							</tr>
						))
					)}
				</tbody>
			</table>

			<div className="inv-totals-wrap">
				<div className="inv-totals">
					{invoice.discount_amount > 0 ? (
						<>
							<div className="inv-total-row">
								<span>Subtotal</span>
								<span>{formatMoney(invoice.subtotal, invoice.currency)}</span>
							</div>
							<div className="inv-total-row">
								<span>Discount</span>
								<span>−{formatMoney(invoice.discount_amount, invoice.currency)}</span>
							</div>
						</>
					) : null}
					<div className="inv-due">
						<span>Amount due</span>
						<span className="amount">{formatMoney(invoice.total_amount, invoice.currency)}</span>
					</div>
					{invoice.payment_method === 'Cash' &&
					invoice.amount_tendered != null &&
					Number.isFinite(Number(invoice.amount_tendered)) ? (
						<div className="inv-cash-settle">
							<div className="inv-total-row">
								<span>Tendered</span>
								<span>{formatMoney(Number(invoice.amount_tendered), invoice.currency)}</span>
							</div>
							<div className="inv-total-row">
								<span>Change</span>
								<span>
									{formatMoney(Number(invoice.change_amount) || 0, invoice.currency)}
								</span>
							</div>
						</div>
					) : null}
				</div>
			</div>

			{invoice.notes ? (
				<div className="inv-notes">
					<p className="inv-notes-label">Notes</p>
					<p className="inv-notes-body">{invoice.notes}</p>
				</div>
			) : null}

			<footer className="inv-footer">
				<div>
					<p className="inv-thanks">Thank you for your business</p>
					<p className="inv-powered">Generated with Shopynn</p>
				</div>
				<div className="inv-footer-right">
					{invoice.company.phone ? <div>{invoice.company.phone}</div> : null}
					{invoice.company.email ? <div>{invoice.company.email}</div> : null}
				</div>
			</footer>
		</div>
	);
}

/** Inject print CSS + document HTML into a print iframe/window body. */
export function wrapInvoicePrintDocument(title: string, bodyHtml: string): string {
	const safeTitle = String(title || 'Invoice').replace(/</g, '');
	return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${safeTitle}</title>
<style>${INVOICE_PRINT_STYLES}</style></head><body>${bodyHtml}</body></html>`;
}
