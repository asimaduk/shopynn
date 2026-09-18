/**
 * Build invoice view-model and PDF buffer for a sale (server-side).
 */

const ACCENT = '#0A74DA';
const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#E2E8F0';
const SOFT = '#F8FAFC';

function formatMoney(amount, currency = 'GHS') {
    const n = Number(amount);
    if (!Number.isFinite(n)) return `${currency} 0.00`;
    return `${currency} ${n.toFixed(2)}`;
}

function formatDate(value) {
    if (!value) {
        return new Date().toLocaleString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
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
        amount_tendered:
            sale.amount_tendered != null && sale.amount_tendered !== ''
                ? Number(sale.amount_tendered)
                : null,
        change_amount:
            sale.change_amount != null && sale.change_amount !== ''
                ? Number(sale.change_amount)
                : null,
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
    if (
        invoice.payment_method === 'Cash' &&
        invoice.amount_tendered != null &&
        Number.isFinite(Number(invoice.amount_tendered))
    ) {
        lines.push(`Tendered: ${formatMoney(Number(invoice.amount_tendered), invoice.currency)}`);
        lines.push(`Change: ${formatMoney(Number(invoice.change_amount) || 0, invoice.currency)}`);
    }
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

        const pageWidth = doc.page.width;
        const left = 48;
        const right = pageWidth - 48;
        const contentWidth = right - left;

        // Header: brand left, invoice badge right
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(18).text(invoice.company.name, left, 48, {
            width: contentWidth * 0.58,
            lineGap: 2,
        });
        let brandBottom = doc.y;
        doc.fillColor(MUTED).font('Helvetica').fontSize(9);
        if (invoice.company.address) {
            doc.text(invoice.company.address, left, brandBottom + 4, { width: contentWidth * 0.58 });
            brandBottom = doc.y;
        }
        if (invoice.company.phone) {
            doc.text(invoice.company.phone, left, brandBottom + 2, { width: contentWidth * 0.58 });
            brandBottom = doc.y;
        }
        if (invoice.company.email) {
            doc.text(invoice.company.email, left, brandBottom + 2, { width: contentWidth * 0.58 });
            brandBottom = doc.y;
        }

        const badgeX = left + contentWidth * 0.55;
        doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(9).text('INVOICE', badgeX, 48, {
            width: contentWidth * 0.45,
            align: 'right',
            characterSpacing: 1.5,
        });
        doc.fillColor(INK).fontSize(14).text(String(invoice.invoice_number), badgeX, 62, {
            width: contentWidth * 0.45,
            align: 'right',
        });
        doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(formatDate(invoice.sale_date), badgeX, 82, {
            width: contentWidth * 0.45,
            align: 'right',
        });

        // Accent rule
        const ruleY = Math.max(brandBottom, 100) + 16;
        doc.rect(left, ruleY, contentWidth * 0.42, 3).fill(ACCENT);
        doc.rect(left + contentWidth * 0.42, ruleY, contentWidth * 0.58, 3).fill(LINE);

        // Bill to / Details
        let y = ruleY + 18;
        doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8).text('BILL TO', left, y, {
            characterSpacing: 1,
        });
        doc.text('DETAILS', left + contentWidth * 0.55, y, {
            width: contentWidth * 0.45,
            align: 'right',
            characterSpacing: 1,
        });

        y += 14;
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(invoice.customer_name, left, y, {
            width: contentWidth * 0.5,
        });
        const contactBits = [invoice.customer_phone, invoice.customer_email].filter(Boolean).join(' · ');
        let leftColBottom = doc.y;
        if (contactBits) {
            doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(contactBits, left, leftColBottom + 2, {
                width: contentWidth * 0.5,
            });
            leftColBottom = doc.y;
        }

        const detailLines = [
            `Payment · ${invoice.payment_method}${invoice.payment_reference ? ` (${invoice.payment_reference})` : ''}`,
        ];
        if (invoice.store_name) detailLines.push(`Store · ${invoice.store_name}`);
        if (invoice.cashier) detailLines.push(`Cashier · ${invoice.cashier}`);

        let detailY = y;
        doc.font('Helvetica').fontSize(9);
        detailLines.forEach((line) => {
            doc.fillColor(INK).text(line, left + contentWidth * 0.45, detailY, {
                width: contentWidth * 0.55,
                align: 'right',
            });
            detailY = doc.y + 2;
        });

        y = Math.max(leftColBottom, detailY) + 20;

        // Table header
        const col = {
            item: left,
            qty: left + contentWidth * 0.52,
            unit: left + contentWidth * 0.64,
            amount: left + contentWidth * 0.8,
        };
        const colW = {
            item: contentWidth * 0.5,
            qty: contentWidth * 0.1,
            unit: contentWidth * 0.14,
            amount: contentWidth * 0.2,
        };

        doc.rect(left, y, contentWidth, 22).fill(SOFT);
        doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).lineWidth(0.75).stroke();
        doc
            .moveTo(left, y + 22)
            .lineTo(right, y + 22)
            .stroke();

        doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8);
        const thY = y + 7;
        doc.text('DESCRIPTION', col.item + 8, thY, { width: colW.item - 8, characterSpacing: 0.6 });
        doc.text('QTY', col.qty, thY, { width: colW.qty, align: 'right', characterSpacing: 0.6 });
        doc.text('UNIT PRICE', col.unit, thY, { width: colW.unit, align: 'right', characterSpacing: 0.6 });
        doc.text('AMOUNT', col.amount, thY, { width: colW.amount - 4, align: 'right', characterSpacing: 0.6 });

        y += 28;
        doc.font('Helvetica').fontSize(9).fillColor(INK);

        invoice.line_items.forEach((row) => {
            if (y > 700) {
                doc.addPage();
                y = 48;
            }
            const nameHeight = doc.heightOfString(row.name, { width: colW.item - 8 });
            const rowH = Math.max(18, nameHeight + 6);
            doc.fillColor(INK).text(row.name, col.item + 8, y, { width: colW.item - 8 });
            doc.fillColor(MUTED).text(String(row.quantity), col.qty, y, { width: colW.qty, align: 'right' });
            doc.text(formatMoney(row.unit_price, invoice.currency), col.unit, y, {
                width: colW.unit,
                align: 'right',
            });
            doc.fillColor(INK).text(formatMoney(row.line_total, invoice.currency), col.amount, y, {
                width: colW.amount - 4,
                align: 'right',
            });
            y += rowH;
            doc
                .moveTo(left, y - 2)
                .lineTo(right, y - 2)
                .strokeColor(LINE)
                .lineWidth(0.5)
                .stroke();
        });

        if (invoice.line_items.length === 0) {
            doc.fillColor(MUTED).text('No line items', left, y, { width: contentWidth, align: 'center' });
            y += 24;
        }

        // Totals
        y += 12;
        const totalsWidth = 220;
        const totalsX = right - totalsWidth;

        if (invoice.discount_amount > 0) {
            doc.fillColor(MUTED).font('Helvetica').fontSize(9);
            doc.text('Subtotal', totalsX, y, { width: 100 });
            doc.fillColor(INK).text(formatMoney(invoice.subtotal, invoice.currency), totalsX + 100, y, {
                width: 120,
                align: 'right',
            });
            y += 16;
            doc.fillColor(MUTED).text('Discount', totalsX, y, { width: 100 });
            doc.fillColor(INK).text(`−${formatMoney(invoice.discount_amount, invoice.currency)}`, totalsX + 100, y, {
                width: 120,
                align: 'right',
            });
            y += 14;
        }

        doc.roundedRect(totalsX, y, totalsWidth, 32, 4).fill(ACCENT);
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10);
        doc.text('Amount due', totalsX + 12, y + 10, { width: 90 });
        doc.fontSize(12).text(formatMoney(invoice.total_amount, invoice.currency), totalsX + 90, y + 9, {
            width: totalsWidth - 102,
            align: 'right',
        });
        y += 44;

        if (
            invoice.payment_method === 'Cash' &&
            invoice.amount_tendered != null &&
            Number.isFinite(Number(invoice.amount_tendered))
        ) {
            doc.fillColor(MUTED).font('Helvetica').fontSize(9);
            doc.text('Tendered', totalsX, y, { width: 100 });
            doc.fillColor(INK).text(formatMoney(Number(invoice.amount_tendered), invoice.currency), totalsX + 100, y, {
                width: 120,
                align: 'right',
            });
            y += 14;
            doc.fillColor(MUTED).text('Change', totalsX, y, { width: 100 });
            doc.fillColor(INK).text(
                formatMoney(Number(invoice.change_amount) || 0, invoice.currency),
                totalsX + 100,
                y,
                { width: 120, align: 'right' },
            );
            y += 18;
        }

        if (invoice.notes) {
            doc.rect(left, y, 3, 36).fill(ACCENT);
            doc.rect(left + 3, y, contentWidth - 3, 36).fill(SOFT);
            doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8).text('NOTES', left + 14, y + 8, {
                characterSpacing: 0.8,
            });
            doc.fillColor(INK).font('Helvetica').fontSize(9).text(invoice.notes, left + 14, y + 18, {
                width: contentWidth - 28,
            });
            y += 48;
        }

        // Footer
        const footerY = Math.max(y + 24, 760);
        doc
            .moveTo(left, footerY)
            .lineTo(right, footerY)
            .strokeColor(LINE)
            .lineWidth(0.75)
            .stroke();
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text('Thank you for your business', left, footerY + 12);
        doc.fillColor(MUTED).font('Helvetica').fontSize(8).text('Generated with Shopynn', left, footerY + 26);
        if (invoice.company.phone || invoice.company.email) {
            const footRight = [invoice.company.phone, invoice.company.email].filter(Boolean).join('\n');
            doc.text(footRight, left, footerY + 12, { width: contentWidth, align: 'right' });
        }

        doc.end();
    });
}

export function invoicePdfFilename(invoiceNumber) {
    const safe = String(invoiceNumber || 'invoice').replace(/[^\w.-]+/g, '_');
    return `invoice-${safe}.pdf`;
}
