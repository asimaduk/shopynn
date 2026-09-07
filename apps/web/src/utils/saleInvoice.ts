/** Sale invoice helpers — preview, PDF, email, WhatsApp (web). */

export type SaleInvoiceLine = {
	name: string;
	quantity: number;
	unit_price: number;
	line_total: number;
};

export type SaleInvoice = {
	invoice_number: string;
	sale_date: string;
	customer_name: string;
	customer_email: string;
	customer_phone: string;
	payment_method: string;
	payment_reference: string;
	store_name: string;
	cashier: string;
	notes: string;
	currency: string;
	company: {
		name: string;
		address: string;
		phone: string;
		email: string;
	};
	line_items: SaleInvoiceLine[];
	subtotal: number;
	discount_amount: number;
	total_amount: number;
};

const THEME = '#0A74DA';

function escapeHtml(value: unknown) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export function formatMoney(amount: number, currency = 'GH₵') {
	const n = Number(amount);
	if (!Number.isFinite(n)) return `${currency} 0.00`;
	return `${currency} ${n.toFixed(2)}`;
}

export function formatInvoiceDate(value?: string) {
	if (!value) return new Date().toLocaleString();
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return String(value);
	return d.toLocaleString();
}

export function normalizeSaleLineItems(order: Record<string, unknown> = {}): SaleInvoiceLine[] {
	const products = Array.isArray(order.products) ? order.products : [];
	if (products.length > 0) {
		return products.map((p: Record<string, unknown>) => {
			const qty = Number(p.quantity ?? p.order_quantity) || 0;
			const unit = Number(p.unit_price) || 0;
			return {
				name: String(p.name || p.product_name || 'Item'),
				quantity: qty,
				unit_price: unit,
				line_total: qty * unit
			};
		});
	}
	return [];
}

type CompanyInfo = {
	name?: string;
	address?: string;
	phone?: string;
	email?: string;
};

export function buildInvoiceFromSaleOrder(
	order: Record<string, unknown>,
	company?: CompanyInfo
): SaleInvoice {
	const lineItems = normalizeSaleLineItems(order);
	const computedSubtotal = lineItems.reduce((s, row) => s + row.line_total, 0);
	const discount = Number(order.discount_amount) || 0;
	const totalRaw = Number(String(order.total_amount ?? order.total ?? 0).replace(/,/g, ''));
	const total =
		Number.isFinite(totalRaw) && totalRaw > 0 ? totalRaw : Math.max(0, computedSubtotal - discount);
	const subtotal = discount > 0 ? total + discount : computedSubtotal || total;

	const paymentType = order.payment_type ?? order.payment_method;
	const paymentMethod =
		paymentType === 2 || paymentType === 'mobile_money' || paymentType === 'momo'
			? 'Mobile Money'
			: paymentType === 'card'
				? 'Card'
				: 'Cash';

	const cashier =
		String(order.attendant || '') ||
		[order.attendant_first_name, order.attendant_last_name].filter(Boolean).join(' ');

	return {
		invoice_number: String(order.invoice_number || order.id || '—'),
		sale_date: String(order.created_at || order.sale_date || new Date().toISOString()),
		customer_name: String(order.customer || 'Walk-in'),
		customer_email: String(order.customer_email || '').trim(),
		customer_phone: String(order.customer_phone || '').trim(),
		payment_method: paymentMethod,
		payment_reference: String(order.payment_reference || order.payment_number || ''),
		store_name: String(order.warehouse || order.store_name || ''),
		cashier,
		notes: String(order.notes || ''),
		currency: 'GH₵',
		company: {
			name: company?.name || 'Shopynn',
			address: company?.address || '',
			phone: company?.phone || '',
			email: company?.email || ''
		},
		line_items: lineItems,
		subtotal,
		discount_amount: discount,
		total_amount: total
	};
}

export function formatInvoiceText(invoice: SaleInvoice): string {
	const lines: string[] = [];
	lines.push(invoice.company.name);
	if (invoice.company.address) lines.push(invoice.company.address);
	if (invoice.company.phone) lines.push(`Tel: ${invoice.company.phone}`);
	if (invoice.company.email) lines.push(invoice.company.email);
	lines.push('--------------------------------');
	lines.push('INVOICE');
	lines.push(`Invoice #: ${invoice.invoice_number}`);
	lines.push(`Date: ${formatInvoiceDate(invoice.sale_date)}`);
	if (invoice.store_name) lines.push(`Store: ${invoice.store_name}`);
	lines.push(`Customer: ${invoice.customer_name}`);
	if (invoice.customer_phone) lines.push(`Phone: ${invoice.customer_phone}`);
	lines.push(`Payment: ${invoice.payment_method}`);
	if (invoice.payment_reference) lines.push(`Reference: ${invoice.payment_reference}`);
	if (invoice.cashier) lines.push(`Cashier: ${invoice.cashier}`);
	lines.push('--------------------------------');
	invoice.line_items.forEach((row) => {
		lines.push(row.name);
		lines.push(
			`  ${row.quantity} x ${formatMoney(row.unit_price, invoice.currency)} = ${formatMoney(row.line_total, invoice.currency)}`
		);
	});
	lines.push('--------------------------------');
	if (invoice.discount_amount > 0) {
		lines.push(`Subtotal: ${formatMoney(invoice.subtotal, invoice.currency)}`);
		lines.push(`Discount: ${formatMoney(invoice.discount_amount, invoice.currency)}`);
	}
	lines.push(`TOTAL: ${formatMoney(invoice.total_amount, invoice.currency)}`);
	if (invoice.notes) lines.push(`Notes: ${invoice.notes}`);
	lines.push('--------------------------------');
	lines.push('Thank you for your business!');
	return lines.join('\n');
}

export function digitsOnlyPhone(phone: string) {
	return String(phone || '').replace(/\D/g, '');
}

export function buildMailtoUrl(email: string, subject: string, body: string) {
	const params: string[] = [];
	if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
	if (body) params.push(`body=${encodeURIComponent(body)}`);
	const query = params.length ? `?${params.join('&')}` : '';
	return email ? `mailto:${encodeURIComponent(email)}${query}` : `mailto:${query}`;
}

export function buildWhatsAppUrl(phoneDigits: string, text: string) {
	const base = phoneDigits ? `https://wa.me/${phoneDigits}` : 'https://wa.me/';
	return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Render invoice DOM node to a PDF blob (A4, multi-page if needed). */
export async function renderInvoicePdfBlob(element: HTMLElement): Promise<Blob> {
	const html2canvas = (await import('html2canvas')).default;
	const { jsPDF } = await import('jspdf');

	const canvas = await html2canvas(element, {
		scale: 2,
		useCORS: true,
		backgroundColor: '#ffffff',
		logging: false
	});

	const imgData = canvas.toDataURL('image/png');
	const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
	const pageWidth = pdf.internal.pageSize.getWidth();
	const pageHeight = pdf.internal.pageSize.getHeight();
	const imgWidth = pageWidth;
	const imgHeight = (canvas.height * imgWidth) / canvas.width;

	let heightLeft = imgHeight;
	let position = 0;

	pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
	heightLeft -= pageHeight;

	while (heightLeft > 0) {
		position = heightLeft - imgHeight;
		pdf.addPage();
		pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
		heightLeft -= pageHeight;
	}

	return pdf.output('blob');
}

export async function downloadInvoicePdf(element: HTMLElement, filename: string) {
	const blob = await renderInvoicePdfBlob(element);
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

export async function shareInvoicePdfFile(
	element: HTMLElement,
	filename: string,
	text: string
): Promise<'shared' | 'downloaded'> {
	const blob = await renderInvoicePdfBlob(element);
	const file = new File([blob], filename.endsWith('.pdf') ? filename : `${filename}.pdf`, {
		type: 'application/pdf'
	});

	if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [file] })) {
		await navigator.share({
			files: [file],
			title: filename,
			text
		});
		return 'shared';
	}

	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = file.name;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
	return 'downloaded';
}

export function getInvoicePreviewHtml(invoice: SaleInvoice): string {
	const rows = invoice.line_items
		.map(
			(row) => `
      <tr>
        <td>${escapeHtml(row.name)}</td>
        <td class="num">${row.quantity}</td>
        <td class="num">${escapeHtml(formatMoney(row.unit_price, invoice.currency))}</td>
        <td class="num">${escapeHtml(formatMoney(row.line_total, invoice.currency))}</td>
      </tr>`
		)
		.join('');

	const discount = Number(invoice.discount_amount) || 0;
	const totals =
		discount > 0
			? `
      <div class="row"><span>Subtotal</span><span>${escapeHtml(formatMoney(invoice.subtotal, invoice.currency))}</span></div>
      <div class="row"><span>Discount</span><span>${escapeHtml(formatMoney(discount, invoice.currency))}</span></div>
      <div class="row grand"><span>Total</span><span>${escapeHtml(formatMoney(invoice.total_amount, invoice.currency))}</span></div>`
			: `<div class="row grand"><span>Total</span><span>${escapeHtml(formatMoney(invoice.total_amount, invoice.currency))}</span></div>`;

	return `
    <h1 style="font-size:1.35rem;margin:0 0 4px;font-weight:700;color:${THEME}">Invoice</h1>
    <p style="margin:0 0 12px;font-weight:700">${escapeHtml(invoice.company.name)}</p>
    <div class="meta">
      ${invoice.company.address ? `<div>${escapeHtml(invoice.company.address)}</div>` : ''}
      ${invoice.company.phone ? `<div>Tel: ${escapeHtml(invoice.company.phone)}</div>` : ''}
      ${invoice.company.email ? `<div>${escapeHtml(invoice.company.email)}</div>` : ''}
      <div><strong>Invoice:</strong> ${escapeHtml(invoice.invoice_number)}</div>
      <div><strong>Date:</strong> ${escapeHtml(formatInvoiceDate(invoice.sale_date))}</div>
      <div><strong>Customer:</strong> ${escapeHtml(invoice.customer_name)}</div>
      <div><strong>Payment:</strong> ${escapeHtml(invoice.payment_method)}</div>
      ${invoice.store_name ? `<div><strong>Store:</strong> ${escapeHtml(invoice.store_name)}</div>` : ''}
      ${invoice.cashier ? `<div><strong>Cashier:</strong> ${escapeHtml(invoice.cashier)}</div>` : ''}
    </div>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th class="num">Qty</th>
          <th class="num">Unit</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="4">No line items</td></tr>'}</tbody>
    </table>
    <div class="totals">${totals}</div>
    ${invoice.notes ? `<p class="foot"><strong>Notes:</strong> ${escapeHtml(invoice.notes)}</p>` : ''}
  `;
}
