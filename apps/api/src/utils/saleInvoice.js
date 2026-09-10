/**
 * Build invoice view-model and PDF buffer for a sale (server-side).
 */

const THEME = '#0A74DA';

function formatMoney(amount, currency = 'GHS') {
    const n = Number(amount);
    if (!Number.isFinite(n)) return `${currency} 0.00`;
    return `${currency} ${n.toFixed(2)}`;
}

function formatDate(value) {
    if (!value) return new Date().toLocaleString();
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
}

export function buildInvoiceFromSaleRow(sale, tenant = {}, warehouseName = '') {
    const products = Array.isArray(sale.products) ? sale.products : [];
    const lineItems = products.map((p) => {
        const qty = Number(p.quantity) || 0;
        const unit = Number(p.unit_price) || 0;
        return {
            name: p.name || 'Item',
            quantity: qty,
            unit_price: unit,
            line_total: qty * unit,
        };
    });

    const computedSubtotal = lineItems.reduce((s, r) => s + r.line_total, 0);
    const discount = Number(sale.discount_amount) || 0;
    const totalRaw = Number(String(sale.total_amount ?? 0).replace(/,/g, ''));
    const total =
        Number.isFinite(totalRaw) && totalRaw > 0 ? totalRaw : Math.max(0, computedSubtotal - discount);
    const subtotal = discount > 0 ? total + discount : computedSubtotal || total;

    const paymentType = sale.payment_type;
    const paymentMethod =
        paymentType === 2 || paymentType === 'mobile_money' || paymentType === 'momo'
            ? 'Mobile Money'
            : paymentType === 3 || paymentType === 'card'
              ? 'Card'
              : 'Cash';

    const addressParts = [tenant.address, tenant.city, tenant.state, tenant.country]
        .filter(Boolean)
        .join(', ');

    return {
        invoice_number: sale.invoice_number || sale.id || '—',
        sale_date: sale.created_at || sale.sale_date || new Date().toISOString(),
        customer_name: sale.customer || 'Walk-in',
        customer_email: String(sale.customer_email || '').trim(),
        customer_phone: String(sale.customer_phone || '').trim(),
        payment_method: paymentMethod,
        payment_reference: sale.payment_reference || sale.payment_number || '',
        store_name: warehouseName || '',
        cashier: [sale.attendant_first_name, sale.attendant_last_name].filter(Boolean).join(' '),
        notes: sale.notes || '',
        currency: 'GHS',
        company: {
            name: tenant.name || tenant.organization || 'Shopynn',
            address: addressParts,
            phone: tenant.phone || '',
            email: tenant.email || '',
        },
        line_items: lineItems,
        subtotal,
        discount_amount: discount,
        total_amount: total,
    };
}

export function formatInvoicePlainText(invoice) {
    const lines = [];
    lines.push(invoice.company.name);
    if (invoice.company.address) lines.push(invoice.company.address);
    if (invoice.company.phone) lines.push(`Tel: ${invoice.company.phone}`);
    if (invoice.company.email) lines.push(invoice.company.email);
    lines.push('--------------------------------');
    lines.push('INVOICE');
    lines.push(`Invoice #: ${invoice.invoice_number}`);
    lines.push(`Date: ${formatDate(invoice.sale_date)}`);
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
            `  ${row.quantity} x ${formatMoney(row.unit_price, invoice.currency)} = ${formatMoney(row.line_total, invoice.currency)}`,
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

export async function buildSaleInvoicePdfBuffer(invoice) {
    const PDFDocument = (await import('pdfkit')).default;

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 48, size: 'A4' });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        doc.fillColor(THEME).fontSize(20).text(invoice.company.name, { align: 'left' });
        doc.fillColor('#333333').fontSize(10);
        if (invoice.company.address) doc.text(invoice.company.address);
        if (invoice.company.phone) doc.text(`Tel: ${invoice.company.phone}`);
        if (invoice.company.email) doc.text(invoice.company.email);

        doc.moveDown();
        doc.fillColor(THEME).fontSize(16).text('Invoice');
        doc.fillColor('#333333').fontSize(10);
        doc.text(`Invoice #: ${invoice.invoice_number}`);
        doc.text(`Date: ${formatDate(invoice.sale_date)}`);
        doc.text(`Customer: ${invoice.customer_name}`);
        if (invoice.customer_phone) doc.text(`Phone: ${invoice.customer_phone}`);
        if (invoice.store_name) doc.text(`Store: ${invoice.store_name}`);
        doc.text(`Payment: ${invoice.payment_method}`);
        if (invoice.cashier) doc.text(`Cashier: ${invoice.cashier}`);

        doc.moveDown();
        const tableTop = doc.y;
        const colX = { item: 48, qty: 320, unit: 380, amount: 460 };

        doc.fontSize(10).fillColor('#ffffff');
        doc.rect(48, tableTop, 515, 22).fill(THEME);
        doc.fillColor('#ffffff');
        doc.text('Item', colX.item + 6, tableTop + 6, { width: 260 });
        doc.text('Qty', colX.qty, tableTop + 6, { width: 50, align: 'right' });
        doc.text('Unit', colX.unit, tableTop + 6, { width: 70, align: 'right' });
        doc.text('Amount', colX.amount, tableTop + 6, { width: 90, align: 'right' });

        let y = tableTop + 26;
        doc.fillColor('#333333').fontSize(9);
        invoice.line_items.forEach((row, i) => {
            if (y > 700) {
                doc.addPage();
                y = 48;
            }
            if (i % 2 === 1) {
                doc.rect(48, y - 2, 515, 18).fill('#f4f6f8');
                doc.fillColor('#333333');
            }
            doc.text(row.name, colX.item + 4, y, { width: 260 });
            doc.text(String(row.quantity), colX.qty, y, { width: 50, align: 'right' });
            doc.text(formatMoney(row.unit_price, invoice.currency), colX.unit, y, { width: 70, align: 'right' });
            doc.text(formatMoney(row.line_total, invoice.currency), colX.amount, y, { width: 90, align: 'right' });
            y += 20;
        });

        doc.moveDown(2);
        const totalsY = Math.max(y + 10, doc.y);
        doc.fontSize(10).fillColor('#333333');
        if (invoice.discount_amount > 0) {
            doc.text(`Subtotal: ${formatMoney(invoice.subtotal, invoice.currency)}`, 360, totalsY, { align: 'right', width: 200 });
            doc.text(`Discount: ${formatMoney(invoice.discount_amount, invoice.currency)}`, 360, totalsY + 16, {
                align: 'right',
                width: 200,
            });
            doc.fontSize(12).text(`Total: ${formatMoney(invoice.total_amount, invoice.currency)}`, 360, totalsY + 36, {
                align: 'right',
                width: 200,
            });
        } else {
            doc.fontSize(12).text(`Total: ${formatMoney(invoice.total_amount, invoice.currency)}`, 360, totalsY, {
                align: 'right',
                width: 200,
            });
        }

        if (invoice.notes) {
            doc.moveDown(2).fontSize(9).text(`Notes: ${invoice.notes}`, 48, doc.y);
        }

        doc.fontSize(8).fillColor('#888888').text('Generated by Shopynn', 48, 780, { align: 'center', width: 515 });
        doc.end();
    });
}

export function invoicePdfFilename(invoiceNumber) {
    const safe = String(invoiceNumber || 'invoice').replace(/[^\w.-]+/g, '_');
    return `invoice-${safe}.pdf`;
}
