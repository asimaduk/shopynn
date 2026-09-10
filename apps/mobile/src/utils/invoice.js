import { Alert, Linking, Platform, Share } from 'react-native';
import RNFS from 'react-native-fs';
import RNShare from 'react-native-share';
import config from '../config';
import { formatSalePaymentLabel } from './salePayment';

const THEME = config.THEME_COLOR || '#0A74DA';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatMoney(amount, currency = 'GH₵') {
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

/** Normalize API sale / pending / checkout payload line items. */
export function normalizeSaleLineItems(sale = {}) {
    const products = Array.isArray(sale.products) ? sale.products : [];
    if (products.length > 0) {
        return products.map((p) => {
            const qty = Number(p.quantity ?? p.order_quantity) || 0;
            const unit = Number(p.unit_price) || 0;
            return {
                name: p.name || p.product_name || 'Item',
                quantity: qty,
                unit_price: unit,
                line_total: qty * unit,
            };
        });
    }

    const items = Array.isArray(sale.items) ? sale.items : [];
    if (items.length > 0) {
        return items.map((p) => {
            const qty = Number(p.order_quantity ?? p.quantity) || 0;
            const unit = Number(p.unit_price) || 0;
            return {
                name: p.name || 'Item',
                quantity: qty,
                unit_price: unit,
                line_total: qty * unit,
            };
        });
    }

    const orders = Array.isArray(sale.orders) ? sale.orders : Array.isArray(sale.orders_full) ? sale.orders_full : [];
    if (orders.length > 0) {
        return orders.map((p) => {
            const qty = Number(p.order_quantity ?? p.quantity) || 0;
            const unit = Number(p.unit_price) || 0;
            return {
                name: p.name || p.product_name || 'Item',
                quantity: qty,
                unit_price: unit,
                line_total: qty * unit,
            };
        });
    }

    const amount = Number(String(sale.amount ?? sale.total_amount ?? 0).replace(/,/g, '')) || 0;
    const count = Number(sale.itemCount ?? sale.number_of_items) || 1;
    if (amount > 0) {
        return [{
            name: 'Sale items',
            quantity: count,
            unit_price: amount / count,
            line_total: amount,
        }];
    }

    return [];
}

export function buildInvoiceFromSale(sale = {}, appSettings = {}) {
    const lineItems = normalizeSaleLineItems(sale);
    const computedSubtotal = lineItems.reduce((s, row) => s + (Number(row.line_total) || 0), 0);
    const discount = Number(sale.discount_amount) || 0;
    const totalFromSale = Number(String(sale.total_amount ?? sale.amount ?? 0).replace(/,/g, ''));
    const total = Number.isFinite(totalFromSale) && totalFromSale > 0
        ? totalFromSale
        : Math.max(0, computedSubtotal - discount);
    const subtotal = discount > 0 ? total + discount : computedSubtotal || total;

    const paymentMethod = formatSalePaymentLabel(sale);

    const companyName =
        appSettings.companyName ||
        appSettings.receiptCompanyName ||
        'Shopynn';

    return {
        invoice_number: sale.invoice_number || sale.invoiceNumber || sale.id || '—',
        sale_date: sale.created_at || sale.date || sale.sale_date || new Date().toISOString(),
        customer_name: sale.customer || sale.customer_name || 'Walk-in',
        customer_email: String(sale.customer_email || sale.customer_obj?.email || '').trim(),
        customer_phone: String(sale.customer_phone || sale.customer_obj?.phone || '').trim(),
        customer_address: sale.customer_address || sale.customer_obj?.address || '',
        payment_method: paymentMethod,
        payment_reference: sale.payment_reference || sale.payment_refrence || sale.payment_number || '',
        store_name: sale.store?.name || sale.warehouse_name || sale.store_name || '',
        cashier:
            sale.user ||
            [sale.attendant_first_name, sale.attendant_last_name].filter(Boolean).join(' ') ||
            [sale.attendant?.first_name, sale.attendant?.last_name].filter(Boolean).join(' ') ||
            '',
        notes: sale.notes || '',
        currency: appSettings.currencySymbol || 'GH₵',
        company: {
            name: companyName,
            address: appSettings.companyAddress || '',
            phone: appSettings.companyPhone || '',
            email: appSettings.companyEmail || '',
        },
        line_items: lineItems,
        subtotal,
        discount_amount: discount,
        total_amount: total,
    };
}

export function formatInvoiceText(invoice) {
    const lines = [];
    lines.push(invoice.company?.name || 'Shopynn');
    if (invoice.company?.address) lines.push(invoice.company.address);
    if (invoice.company?.phone) lines.push(`Tel: ${invoice.company.phone}`);
    if (invoice.company?.email) lines.push(invoice.company.email);
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
    (invoice.line_items || []).forEach((row) => {
        lines.push(row.name);
        lines.push(
            `  ${row.quantity} x ${formatMoney(row.unit_price, invoice.currency)} = ${formatMoney(row.line_total, invoice.currency)}`,
        );
    });
    lines.push('--------------------------------');
    if (Number(invoice.discount_amount) > 0) {
        lines.push(`Subtotal: ${formatMoney(invoice.subtotal, invoice.currency)}`);
        lines.push(`Discount: ${formatMoney(invoice.discount_amount, invoice.currency)}`);
    }
    lines.push(`TOTAL: ${formatMoney(invoice.total_amount, invoice.currency)}`);
    if (invoice.notes) lines.push(`Notes: ${invoice.notes}`);
    lines.push('--------------------------------');
    lines.push('Thank you for your business!');
    return lines.join('\n');
}

export function formatInvoiceHtml(invoice) {
    const rows = (invoice.line_items || [])
        .map(
            (row) => `
        <tr>
            <td>${escapeHtml(row.name)}</td>
            <td class="num">${row.quantity}</td>
            <td class="num">${escapeHtml(formatMoney(row.unit_price, invoice.currency))}</td>
            <td class="num">${escapeHtml(formatMoney(row.line_total, invoice.currency))}</td>
        </tr>`,
        )
        .join('');

    const discount = Number(invoice.discount_amount) || 0;
    const totalsBlock =
        discount > 0
            ? `
        <div class="row"><span>Subtotal</span><span>${escapeHtml(formatMoney(invoice.subtotal, invoice.currency))}</span></div>
        <div class="row"><span>Discount</span><span>${escapeHtml(formatMoney(discount, invoice.currency))}</span></div>
        <div class="row grand"><span>Total</span><span>${escapeHtml(formatMoney(invoice.total_amount, invoice.currency))}</span></div>`
            : `<div class="row grand"><span>Total</span><span>${escapeHtml(formatMoney(invoice.total_amount, invoice.currency))}</span></div>`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Invoice ${escapeHtml(invoice.invoice_number)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; color: #111827; background: #f8fafc; }
    .sheet { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 28px; box-shadow: 0 10px 30px rgba(15,23,42,0.08); }
    .brand { color: ${THEME}; font-size: 1.5rem; font-weight: 700; margin: 0 0 4px; }
    .company-meta { color: #64748b; font-size: 0.875rem; line-height: 1.5; margin-bottom: 20px; }
    h2 { margin: 0 0 12px; font-size: 1.1rem; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; font-size: 0.875rem; margin-bottom: 20px; }
    .meta strong { color: #334155; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin: 16px 0; }
    th { background: ${THEME}; color: #fff; text-align: left; padding: 10px 12px; }
    th.num, td.num { text-align: right; }
    td { border-bottom: 1px solid #e2e8f0; padding: 10px 12px; }
    tr:nth-child(even) td { background: #f8fafc; }
    .totals { margin-left: auto; max-width: 280px; margin-top: 12px; }
    .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 0.95rem; }
    .grand { font-weight: 700; font-size: 1.05rem; border-top: 2px solid #111827; margin-top: 8px; padding-top: 10px; }
    .foot { margin-top: 24px; color: #64748b; font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="sheet">
    <p class="brand">${escapeHtml(invoice.company?.name)}</p>
    <div class="company-meta">
      ${invoice.company?.address ? `<div>${escapeHtml(invoice.company.address)}</div><br/>` : ''}
      ${invoice.company?.phone ? `Tel: ${escapeHtml(invoice.company.phone)}<br/>` : ''}
      ${invoice.company?.email ? escapeHtml(invoice.company.email) : ''}
    </div>
    <h2>Invoice</h2>
    <div class="meta">
      <div><strong>Invoice #</strong><br/>${escapeHtml(invoice.invoice_number)}</div></div>
      <div><strong>Date</strong><br/>${escapeHtml(formatDate(invoice.sale_date))}</div></div>
      <div><strong>Customer</strong><br/>${escapeHtml(invoice.customer_name)}</div></div>
      <div><strong>Payment</strong><br/>${escapeHtml(invoice.payment_method)}</div></div>
      ${invoice.store_name ? `<div><strong>Store</strong><br/>${escapeHtml(invoice.store_name)}</div></div>` : ''}
      ${invoice.cashier ? `<div><strong>Cashier</strong><br/>${escapeHtml(invoice.cashier)}</div></div>` : ''}
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
    <div class="totals">${totalsBlock}</div>
    ${invoice.notes ? `<p class="foot"><strong>Notes:</strong> ${escapeHtml(invoice.notes)}</p>` : ''}
    <p class="foot">Generated by Shopynn</p>
  </div>
</body>
</html>`;
}

export function digitsOnlyPhone(phone) {
    return String(phone || '').replace(/\D/g, '');
}

export function buildMailtoUrl(email, subject, body) {
    const params = [];
    if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
    if (body) params.push(`body=${encodeURIComponent(body)}`);
    const query = params.length ? `?${params.join('&')}` : '';
    return `mailto:${encodeURIComponent(email)}${query}`;
}

export function buildWhatsAppUrl(phoneDigits, text) {
    const base = phoneDigits ? `https://wa.me/${phoneDigits}` : 'https://wa.me/';
    return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

async function writeInvoiceHtmlFile(invoice) {
    const safeName = String(invoice.invoice_number || 'invoice').replace(/[^\w.-]+/g, '_');
    const path = `${RNFS.CachesDirectoryPath}/invoice-${safeName}.html`;
    const html = formatInvoiceHtml(invoice);
    await RNFS.writeFile(path, html, 'utf8');
    return Platform.OS === 'ios' ? path : `file://${path}`;
}

export async function shareInvoiceAsHtml(invoice) {
    const fileUrl = await writeInvoiceHtmlFile(invoice);
    await RNShare.open({
        title: `Invoice ${invoice.invoice_number}`,
        message: formatInvoiceText(invoice),
        url: fileUrl,
        type: 'text/html',
        subject: `Invoice ${invoice.invoice_number}`,
        failOnCancel: false,
    });
}

export async function shareInvoiceGeneric(invoice) {
    const text = formatInvoiceText(invoice);
    await Share.share({
        message: text,
        title: `Invoice ${invoice.invoice_number}`,
    });
}

export async function shareInvoiceByEmail(invoice, emailOverride) {
    const email = String(emailOverride || invoice.customer_email || '').trim();
    const subject = `Invoice ${invoice.invoice_number}`;
    const body = formatInvoiceText(invoice);

    if (!email) {
        const url = buildMailtoUrl('', subject, body);
        const ok = await Linking.canOpenURL(url);
        if (!ok) {
            Alert.alert('Email', 'No email app is available on this device.');
            return;
        }
        await Linking.openURL(url);
        return;
    }

    const url = buildMailtoUrl(email, subject, body);
    const ok = await Linking.canOpenURL(url);
    if (!ok) {
        Alert.alert('Email', 'Could not open your email app.');
        return;
    }
    await Linking.openURL(url);
}

export async function shareInvoiceByWhatsApp(invoice, phoneOverride) {
    const digits = digitsOnlyPhone(phoneOverride || invoice.customer_phone);
    const text = formatInvoiceText(invoice);
    const url = buildWhatsAppUrl(digits, text);
    const ok = await Linking.canOpenURL(url);
    if (!ok) {
        Alert.alert(
            'WhatsApp',
            digits
                ? 'WhatsApp is not installed. Install WhatsApp or use Share to send the invoice another way.'
                : 'WhatsApp is not installed. Install WhatsApp, or add a customer phone number.',
        );
        return;
    }
    await Linking.openURL(url);
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    if (typeof globalThis.btoa === 'function') return globalThis.btoa(binary);
    // eslint-disable-next-line no-undef
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    throw new Error('Cannot encode PDF for sharing on this device.');
}

export async function fetchInvoicePdfToCache(saleId, invoice) {
    const { sales: salesApi } = await import('../services/api');
    const data = await salesApi.downloadInvoicePdf(saleId);
    const bytes =
        data instanceof ArrayBuffer
            ? new Uint8Array(data)
            : data?.buffer
              ? new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength || data.length)
              : new Uint8Array(data || []);
    if (bytes.length < 5) {
        throw new Error('Empty response from invoice PDF endpoint.');
    }
    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (magic !== '%PDF') {
        throw new Error('Server did not return a PDF file. Please try again.');
    }

    const safeName = String(invoice?.invoice_number || saleId).replace(/[^\w.-]+/g, '_');
    const path = `${RNFS.CachesDirectoryPath}/invoice-${safeName}.pdf`;
    const base64 = arrayBufferToBase64(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    await RNFS.writeFile(path, base64, 'base64');
    return {
        path,
        fileUrl: Platform.OS === 'ios' ? path : `file://${path}`,
        filename: `invoice-${safeName}.pdf`,
    };
}

export async function shareInvoiceAsPdfFromServer(saleId, invoice) {
    const file = await fetchInvoicePdfToCache(saleId, invoice);
    await RNShare.open({
        title: `Invoice ${invoice?.invoice_number || ''}`,
        url: file.fileUrl,
        type: 'application/pdf',
        filename: file.filename,
        failOnCancel: false,
    });
}

/** Save official PDF to device storage (Downloads on Android when available). */
export async function downloadInvoicePdfFromServer(saleId, invoice) {
    const file = await fetchInvoicePdfToCache(saleId, invoice);
    let destDir = RNFS.DocumentDirectoryPath;
    if (Platform.OS === 'android' && RNFS.DownloadDirectoryPath) {
        try {
            const canWrite = await RNFS.exists(RNFS.DownloadDirectoryPath);
            if (canWrite) destDir = RNFS.DownloadDirectoryPath;
        } catch {
            /* keep Documents */
        }
    }
    const destPath = `${destDir}/${file.filename}`;
    const exists = await RNFS.exists(destPath);
    if (exists) await RNFS.unlink(destPath);
    await RNFS.copyFile(file.path, destPath);

    if (Platform.OS === 'ios') {
        await RNShare.open({
            title: `Invoice ${invoice?.invoice_number || ''}`,
            url: destPath,
            type: 'application/pdf',
            filename: file.filename,
            saveToFiles: true,
            failOnCancel: false,
        });
    }

    return destPath;
}

export async function sendInvoiceEmailFromServer(saleId, email) {
    const { sales: salesApi } = await import('../services/api');
    return salesApi.sendInvoice(saleId, email ? { email } : {});
}

export async function shareInvoice(invoice, method, options = {}) {
    const { saleId, email } = options;
    switch (method) {
        case 'pdf':
            if (!saleId) throw new Error('Sale must be saved before downloading PDF.');
            return downloadInvoicePdfFromServer(saleId, invoice);
        case 'share':
            if (!saleId) throw new Error('Sale must be saved before sharing PDF.');
            await shareInvoiceAsPdfFromServer(saleId, invoice);
            break;
        case 'server-email':
            if (!saleId) throw new Error('Sale must be saved before sending email.');
            await sendInvoiceEmailFromServer(saleId, email || invoice.customer_email);
            break;
        case 'email':
            await shareInvoiceByEmail(invoice, email);
            break;
        case 'whatsapp':
            await shareInvoiceByWhatsApp(invoice);
            break;
        default:
            throw new Error('Unknown share method.');
    }
    return null;
}
