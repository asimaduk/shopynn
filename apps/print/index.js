const express = require('express');
const cors = require('cors');
const escpos = require('escpos');
escpos.USB = require('escpos-usb');
const pkg = require('./package.json');

const PRINT_HOST = process.env.PRINT_HOST || '0.0.0.0';
const PRINT_PORT = Number(process.env.PRINT_PORT) || 3001;

let device;

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors());

const DIVIDER = '--------------------------------';

function formatMoney(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.00';
    return n.toFixed(2);
}

function formatDateTime(dt) {
    try {
        const d = dt ? new Date(dt) : new Date();
        if (Number.isNaN(d.getTime())) return String(dt || '');
        const day = String(d.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const mon = months[d.getMonth()] || '';
        const year = d.getFullYear();
        let h = d.getHours();
        const m = String(d.getMinutes()).padStart(2, '0');
        const apm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        if (h === 0) h = 12;
        return `${day}/${mon}/${year} ${h}:${m} ${apm}`;
    } catch (_) {
        return String(dt || '');
    }
}

function truncate(str, max) {
    const s = String(str || '').trim();
    if (s.length <= max) return s;
    return `${s.slice(0, Math.max(0, max - 1))}…`;
}

function pad(str, width, align = 'left') {
    const s = String(str ?? '');
    if (s.length >= width) return s.slice(0, width);
    const space = ' '.repeat(width - s.length);
    return align === 'right' ? space + s : s + space;
}

/** 32-char thermal line: Item(14) Qty(4) Price(7) Amt(7) */
function itemLine(name, qty, price, amount) {
    return (
        pad(truncate(name, 14), 14, 'left') +
        pad(String(qty), 4, 'right') +
        pad(formatMoney(price), 7, 'right') +
        pad(formatMoney(amount), 7, 'right')
    );
}

function probeUsbPrinter() {
    try {
        const devices = typeof escpos.USB.findPrinter === 'function' ? escpos.USB.findPrinter() : null;
        if (Array.isArray(devices)) return devices.length > 0;
        // Fallback: attempt constructing without opening
        return true;
    } catch (_) {
        return false;
    }
}

app.get('/health', (_req, res) => {
    let printerConnected = false;
    try {
        printerConnected = probeUsbPrinter();
    } catch (_) {
        printerConnected = false;
    }
    res.status(200).json({
        ok: true,
        service: 'shopynn-print',
        version: pkg.version || '1.0.0',
        printer_connected: printerConnected,
        port: PRINT_PORT,
    });
});

app.post('/print', async (req, res) => {
    try {
        if (!device) {
            try {
                device = new escpos.USB();
            } catch (usbErr) {
                return res.status(503).send({
                    status: 503,
                    message:
                        'No USB thermal printer found. Plug in the printer and restart Shopynn Print. ' +
                        (usbErr?.message || ''),
                });
            }
        }

        const body = req.body || {};
        const invoice_number = body.invoice_number || body.invoiceNumber || '—';
        const customer = body.customer || body.customer_name || 'Walk-in';
        const sale_date = body.sale_date || body.created_at || new Date().toISOString();
        const cashier = body.cashier || body.operator || '';
        const notes = body.notes || '';
        const companyName = body?.company?.name || body?.company_name || body?.business_name || 'Shopynn';
        const companyTagline = body?.company?.organization || body?.company_organization || body?.company_tagline || '';
        const companyAddress = body?.company?.address || body?.company_address || '';
        const companyLandmark = body?.company?.landmark || body?.company_landmark || '';
        const companyPhone =
            body?.company?.phone || body?.company_phone || body?.company?.contact || body?.company_contact || '';

        const cartItems = Array.isArray(body.products) ? body.products : [];
        if (!cartItems.length) {
            return res.status(400).send({ status: 400, message: 'No products to print.' });
        }

        let total = 0;
        let itemCount = 0;
        for (const cartItem of cartItems) {
            const qty = Number(cartItem.quantity) || 0;
            const unit = Number(cartItem.unit_price) || 0;
            total += qty * unit;
            itemCount += qty;
        }
        const discount = Number(body.discount_amount) || 0;
        if (Number.isFinite(Number(body.total_amount))) {
            total = Number(body.total_amount);
        }

        const options = { encoding: 'GB18030' };
        const printer = new escpos.Printer(device, options);

        await new Promise((resolve, reject) => {
            device.open(function (err) {
                if (err) {
                    device = null;
                    reject(err);
                    return;
                }
                try {
                    printer
                        .font('a')
                        .align('ct')
                        .style('b')
                        .size(1, 1)
                        .encode('utf8')
                        .text(truncate(companyName, 28))
                        .style('NORMAL')
                        .size(0, 0);

                    if (companyTagline) printer.text(truncate(companyTagline, 32));
                    if (companyAddress) printer.text(truncate(companyAddress, 32));
                    if (companyLandmark) printer.text(truncate(companyLandmark, 32));
                    if (companyPhone) printer.text(truncate(companyPhone, 32));

                    printer
                        .text(DIVIDER)
                        .align('lt')
                        .tableCustom([
                            { text: 'Receipt', align: 'LEFT', width: 0.35 },
                            { text: String(invoice_number), align: 'RIGHT', width: 0.65 },
                        ])
                        .tableCustom([
                            { text: 'Date', align: 'LEFT', width: 0.35 },
                            { text: formatDateTime(sale_date), align: 'RIGHT', width: 0.65 },
                        ]);

                    if (cashier) {
                        printer.tableCustom([
                            { text: 'Cashier', align: 'LEFT', width: 0.35 },
                            { text: truncate(cashier, 20), align: 'RIGHT', width: 0.65 },
                        ]);
                    }

                    printer.tableCustom([
                        { text: 'Customer', align: 'LEFT', width: 0.35 },
                        { text: truncate(customer, 20), align: 'RIGHT', width: 0.65 },
                    ]);

                    printer
                        .text(DIVIDER)
                        .text(itemLine('Item', 'Qty', 'Price', 'Amount'))
                        .text(DIVIDER);

                    cartItems.forEach((item) => {
                        const qty = Number(item.quantity) || 0;
                        const unit = Number(item.unit_price) || 0;
                        const amount = qty * unit;
                        printer.text(itemLine(item.name || item.product_name || 'Item', qty, unit, amount));
                    });

                    printer.text(DIVIDER);

                    if (discount > 0) {
                        printer.tableCustom([
                            { text: 'Discount', align: 'LEFT', width: 0.55 },
                            { text: `GHS ${formatMoney(discount)}`, align: 'RIGHT', width: 0.45 },
                        ]);
                    }

                    printer
                        .tableCustom([
                            { text: 'Items', align: 'LEFT', width: 0.55 },
                            { text: String(itemCount), align: 'RIGHT', width: 0.45 },
                        ])
                        .style('b')
                        .tableCustom([
                            { text: 'TOTAL', align: 'LEFT', width: 0.55 },
                            { text: `GHS ${formatMoney(total)}`, align: 'RIGHT', width: 0.45 },
                        ])
                        .style('NORMAL');

                    if (notes) {
                        printer.text(DIVIDER).text(truncate(notes, 64));
                    }

                    printer
                        .text(DIVIDER)
                        .align('ct')
                        .text('Thank you for your purchase')
                        .text('Powered by Shopynn')
                        .text('\n')
                        .cut()
                        .close();

                    resolve();
                } catch (printErr) {
                    reject(printErr);
                }
            });
        });

        console.log('Print done!');
        res.status(200).send({ status: 200, message: 'Print successful' });
    } catch (error) {
        console.error('Print failed:', error);
        const msg = error?.message || String(error);
        const hint = /LIBUSB|USB|device|access|busy/i.test(msg)
            ? ' Check that the printer is plugged in and not in use by another app.'
            : '';
        res.status(500).send({ status: 500, message: `Print failed: ${msg}.${hint}` });
    }
});

app.listen(PRINT_PORT, PRINT_HOST, () => {
    console.log(`Shopynn Print v${pkg.version || '1.0.0'} listening on http://${PRINT_HOST}:${PRINT_PORT}`);
});
