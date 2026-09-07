export function formatReceipt(opts) {
    const {
        orders = [],
        customerName = 'Walk-in',
        storeName = '',
        paymentMethod = 'cash',
        invoiceNumber = '',
        companyName = 'Shopynn',
        currency = 'GH₵',
    } = opts;
    const lines = [];
    lines.push(companyName);
    lines.push('--------------------------------');
    if (invoiceNumber) lines.push(`Invoice #${invoiceNumber}`);
    lines.push(`Date: ${new Date().toLocaleString()}`);
    if (storeName) lines.push(`Store: ${storeName}`);
    lines.push(`Customer: ${customerName}`);
    lines.push(`Payment: ${paymentMethod}`);
    lines.push('--------------------------------');
    let subtotal = 0;
    orders.forEach((item) => {
        const qty = Number(item.order_quantity) || 1;
        const price = Number(item.unit_price) || 0;
        const lineTotal = qty * price;
        subtotal += lineTotal;
        lines.push(`${item.name}`);
        lines.push(`  ${qty} x ${currency} ${price.toFixed(2)} = ${currency} ${lineTotal.toFixed(2)}`);
    });
    lines.push('--------------------------------');
    lines.push(`TOTAL: ${currency} ${subtotal.toFixed(2)}`);
    lines.push('--------------------------------');
    lines.push('Thank you!');
    return lines.join('\n');
}

export function formatPurchaseReceipt(opts) {
    const {
        orders = [],
        supplierName = '',
        storeName = '',
        invoiceNumber = '',
        companyName = 'Shopynn',
        currency = 'GH₵',
    } = opts;
    const lines = [];
    lines.push(companyName);
    lines.push('PURCHASE RECEIPT');
    lines.push('--------------------------------');
    if (invoiceNumber) lines.push(`PO #${invoiceNumber}`);
    lines.push(`Date: ${new Date().toLocaleString()}`);
    if (storeName) lines.push(`Store: ${storeName}`);
    lines.push(`Supplier: ${supplierName}`);
    lines.push('--------------------------------');
    let total = 0;
    orders.forEach((item) => {
        const qty = Number(item.order_quantity) || 1;
        const price = Number(item.unit_price) || 0;
        const lineTotal = qty * price;
        total += lineTotal;
        lines.push(`${item.name}`);
        lines.push(`  ${qty} x ${currency} ${price.toFixed(2)} = ${currency} ${lineTotal.toFixed(2)}`);
    });
    lines.push('--------------------------------');
    lines.push(`TOTAL: ${currency} ${total.toFixed(2)}`);
    lines.push('--------------------------------');
    return lines.join('\n');
}
