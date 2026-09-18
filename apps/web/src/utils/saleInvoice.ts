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
	amount_tendered?: number | null;
	change_amount?: number | null;
};

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
	if (!value) {
		return new Date().toLocaleString(undefined, {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return String(value);
	return d.toLocaleString(undefined, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
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
		total_amount: total,
		amount_tendered:
			order.amount_tendered != null && order.amount_tendered !== ''
				? Number(order.amount_tendered)
				: null,
		change_amount:
			order.change_amount != null && order.change_amount !== ''
				? Number(order.change_amount)
				: null
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
	if (
		invoice.payment_method === 'Cash' &&
		invoice.amount_tendered != null &&
		Number.isFinite(Number(invoice.amount_tendered))
	) {
		lines.push(`Tendered: ${formatMoney(Number(invoice.amount_tendered), invoice.currency)}`);
		lines.push(
			`Change: ${formatMoney(Number(invoice.change_amount) || 0, invoice.currency)}`
		);
	}
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
        <td class="num muted">${row.quantity}</td>
        <td class="num muted">${escapeHtml(formatMoney(row.unit_price, invoice.currency))}</td>
        <td class="num">${escapeHtml(formatMoney(row.line_total, invoice.currency))}</td>
      </tr>`
		)
		.join('');

	const contactBits = [invoice.customer_phone, invoice.customer_email].filter(Boolean);
	const discount = Number(invoice.discount_amount) || 0;
	const totalsRows =
		discount > 0
			? `
      <div class="inv-total-row"><span>Subtotal</span><span>${escapeHtml(formatMoney(invoice.subtotal, invoice.currency))}</span></div>
      <div class="inv-total-row"><span>Discount</span><span>−${escapeHtml(formatMoney(discount, invoice.currency))}</span></div>`
			: '';

	return `
    <div class="inv-root">
      <header class="inv-header">
        <div>
          <h1 class="inv-brand-name">${escapeHtml(invoice.company.name)}</h1>
          <div class="inv-brand-meta">
            ${invoice.company.address ? `<div>${escapeHtml(invoice.company.address)}</div>` : ''}
            ${invoice.company.phone ? `<div>${escapeHtml(invoice.company.phone)}</div>` : ''}
            ${invoice.company.email ? `<div>${escapeHtml(invoice.company.email)}</div>` : ''}
          </div>
        </div>
        <div class="inv-badge-wrap">
          <p class="inv-badge">Invoice</p>
          <p class="inv-number">${escapeHtml(invoice.invoice_number)}</p>
          <p class="inv-date">${escapeHtml(formatInvoiceDate(invoice.sale_date))}</p>
        </div>
      </header>
      <hr class="inv-rule" />
      <section class="inv-meta">
        <div class="inv-meta-col">
          <p class="inv-label">Bill to</p>
          <p class="inv-customer">${escapeHtml(invoice.customer_name)}</p>
          ${contactBits.length ? `<p class="inv-customer-sub">${escapeHtml(contactBits.join(' · '))}</p>` : ''}
        </div>
        <div class="inv-meta-col right">
          <p class="inv-label">Details</p>
          <div class="inv-detail-row"><span>Payment · </span>${escapeHtml(invoice.payment_method)}${
						invoice.payment_reference ? ` (${escapeHtml(invoice.payment_reference)})` : ''
					}</div>
          ${invoice.store_name ? `<div class="inv-detail-row"><span>Store · </span>${escapeHtml(invoice.store_name)}</div>` : ''}
          ${invoice.cashier ? `<div class="inv-detail-row"><span>Cashier · </span>${escapeHtml(invoice.cashier)}</div>` : ''}
        </div>
      </section>
      <table class="inv-table">
        <thead>
          <tr>
            <th>Description</th>
            <th class="num">Qty</th>
            <th class="num">Unit price</th>
            <th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="4" class="inv-empty">No line items</td></tr>'}</tbody>
      </table>
      <div class="inv-totals-wrap">
        <div class="inv-totals">
          ${totalsRows}
          <div class="inv-due">
            <span>Amount due</span>
            <span class="amount">${escapeHtml(formatMoney(invoice.total_amount, invoice.currency))}</span>
          </div>
          ${
						invoice.payment_method === 'Cash' &&
						invoice.amount_tendered != null &&
						Number.isFinite(Number(invoice.amount_tendered))
							? `<div class="inv-cash-settle">
            <div class="inv-total-row"><span>Tendered</span><span>${escapeHtml(formatMoney(Number(invoice.amount_tendered), invoice.currency))}</span></div>
            <div class="inv-total-row"><span>Change</span><span>${escapeHtml(formatMoney(Number(invoice.change_amount) || 0, invoice.currency))}</span></div>
          </div>`
							: ''
					}
        </div>
      </div>
      ${
				invoice.notes
					? `<div class="inv-notes"><p class="inv-notes-label">Notes</p><p class="inv-notes-body">${escapeHtml(invoice.notes)}</p></div>`
					: ''
			}
      <footer class="inv-footer">
        <div>
          <p class="inv-thanks">Thank you for your business</p>
          <p class="inv-powered">Generated with Shopynn</p>
        </div>
        <div class="inv-footer-right">
          ${invoice.company.phone ? `<div>${escapeHtml(invoice.company.phone)}</div>` : ''}
          ${invoice.company.email ? `<div>${escapeHtml(invoice.company.email)}</div>` : ''}
        </div>
      </footer>
    </div>
  `;
}
