const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const escpos = require('escpos');
escpos.USB = require('escpos-usb');
const pkg = require('./package.json');

// Bound to all interfaces so phones on the shop Wi-Fi can reach it; /print and /pair are
// protected by the pairing key and the browser origin allowlist below instead.
const PRINT_HOST = process.env.PRINT_HOST || '0.0.0.0';
const PRINT_PORT = Number(process.env.PRINT_PORT) || 3001;
const DATA_DIR = process.env.PRINT_DATA_DIR || path.join(__dirname, 'data');

const DEFAULT_ALLOWED_ORIGINS = [
    'https://dashboard.shopynn.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
];
const ALLOWED_ORIGINS = new Set([
    ...DEFAULT_ALLOWED_ORIGINS,
    ...String(process.env.PRINT_ALLOWED_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
]);

const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function normalizeKey(raw) {
    return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function formatKey(key) {
    return key.replace(/(.{5})(?=.)/g, '$1-');
}

/** 10 characters from a 32-letter alphabet (~50 bits), generated once and kept in DATA_DIR. */
function loadOrCreatePairingKey() {
    if (process.env.PRINT_PAIRING_KEY) return normalizeKey(process.env.PRINT_PAIRING_KEY);
    const file = path.join(DATA_DIR, 'pairing-key');
    try {
        const existing = normalizeKey(fs.readFileSync(file, 'utf8'));
        if (existing.length >= 10) return existing;
    } catch (_) {
        /* first run */
    }
    let key = '';
    for (const byte of crypto.randomBytes(10)) key += KEY_ALPHABET[byte % KEY_ALPHABET.length];
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, key, { mode: 0o600 });
    return key;
}

const PAIRING_KEY = loadOrCreatePairingKey();

function keyMatches(raw) {
    const given = Buffer.from(normalizeKey(raw));
    const expected = Buffer.from(PAIRING_KEY);
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

const FAILED_KEY_LIMIT = 10;
const FAILED_KEY_WINDOW_MS = 10 * 60 * 1000;
const failedKeyAttempts = new Map();

function tooManyFailures(ip) {
    const entry = failedKeyAttempts.get(ip);
    if (!entry || Date.now() > entry.resetAt) return false;
    return entry.count >= FAILED_KEY_LIMIT;
}

function recordFailure(ip) {
    const now = Date.now();
    const entry = failedKeyAttempts.get(ip);
    if (!entry || now > entry.resetAt) {
        failedKeyAttempts.set(ip, { count: 1, resetAt: now + FAILED_KEY_WINDOW_MS });
    } else {
        entry.count += 1;
    }
}

function requirePairingKey(req, res, next) {
    const ip = req.ip || 'unknown';
    if (tooManyFailures(ip)) {
        return res.status(429).send({ status: 429, message: 'Too many wrong pairing codes. Try again in 10 minutes.' });
    }
    if (!keyMatches(req.get('X-Print-Key'))) {
        recordFailure(ip);
        return res.status(401).send({
            status: 401,
            code: 'PAIRING_REQUIRED',
            message: 'Enter this print agent’s pairing code in Shopynn (Print agent → Print pairing code).',
        });
    }
    next();
}

let device;

const app = express();

// Browsers may only call the agent from Shopynn pages. Native apps send no Origin.
app.use((req, res, next) => {
    const origin = req.get('Origin');
    if (!origin) return next();
    if (!ALLOWED_ORIGINS.has(origin)) {
        return res.status(403).send({ status: 403, message: 'This website is not allowed to use Shopynn Print.' });
    }
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Print-Key');
    if (req.get('Access-Control-Request-Private-Network')) {
        res.set('Access-Control-Allow-Private-Network', 'true');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});
app.use(express.json({ limit: '256kb' }));

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

app.get('/health', (req, res) => {
    let printerConnected = false;
    try {
        printerConnected = probeUsbPrinter();
    } catch (_) {
        printerConnected = false;
    }
    const suppliedKey = req.get('X-Print-Key');
    let keyValid = null;
    if (suppliedKey) {
        const ip = req.ip || 'unknown';
        if (tooManyFailures(ip)) {
            keyValid = false;
        } else {
            keyValid = keyMatches(suppliedKey);
            if (!keyValid) recordFailure(ip);
        }
    }
    res.status(200).json({
        ok: true,
        service: 'shopynn-print',
        version: pkg.version || '1.0.0',
        printer_connected: printerConnected,
        port: PRINT_PORT,
        pairing_required: true,
        key_valid: keyValid,
    });
});

/** Opens the USB printer, or responds 503 and returns null. */
function ensureDevice(res) {
    if (device) return device;
    try {
        device = new escpos.USB();
        return device;
    } catch (usbErr) {
        res.status(503).send({
            status: 503,
            message:
                'No USB thermal printer found. Plug in the printer and restart Shopynn Print. ' +
                (usbErr?.message || ''),
        });
        return null;
    }
}

const PAIR_PRINT_INTERVAL_MS = 30 * 1000;
let lastPairPrintAt = 0;

/**
 * Prints the pairing code on the receipt printer, so only someone standing at the printer can
 * read it. Throttled so it can't be used to waste paper.
 */
app.post('/pair', async (_req, res) => {
    const now = Date.now();
    if (now - lastPairPrintAt < PAIR_PRINT_INTERVAL_MS) {
        return res.status(429).send({ status: 429, message: 'Pairing code was just printed. Check the printer.' });
    }
    if (!ensureDevice(res)) return;
    lastPairPrintAt = now;
    try {
        const printer = new escpos.Printer(device, { encoding: 'GB18030' });
        await new Promise((resolve, reject) => {
            device.open((err) => {
                if (err) {
                    device = null;
                    reject(err);
                    return;
                }
                try {
                    printer
                        .font('a')
                        .align('ct')
                        .text('Shopynn Print pairing code')
                        .text(DIVIDER)
                        .style('b')
                        .size(1, 1)
                        .text(formatKey(PAIRING_KEY))
                        .size(0, 0)
                        .style('NORMAL')
                        .text(DIVIDER)
                        .text('Enter this code in Shopynn')
                        .text('under Print agent.')
                        .text('Keep it private.')
                        .text('\n')
                        .cut()
                        .close();
                    resolve();
                } catch (printErr) {
                    reject(printErr);
                }
            });
        });
        res.status(200).send({ status: 200, message: 'Pairing code printed. Enter it to finish connecting.' });
    } catch (error) {
        console.error('Pairing print failed:', error?.message || error);
        res.status(500).send({ status: 500, message: `Could not print the pairing code: ${error?.message || error}` });
    }
});

app.post('/print', requirePairingKey, async (req, res) => {
    try {
        if (!ensureDevice(res)) return;

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
    console.log('Pair a device from Shopynn: Print agent → Print pairing code.');
});
