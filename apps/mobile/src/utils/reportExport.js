import { Alert, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import RNShare from 'react-native-share';

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    if (typeof globalThis.btoa === 'function') return globalThis.btoa(binary);
    // eslint-disable-next-line no-undef
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    throw new Error('Cannot encode file for sharing on this device.');
}

function toUint8Array(data) {
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (data?.buffer) {
        return new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength || data.length);
    }
    return new Uint8Array(data || []);
}

function sanitizeFileBase(name) {
    return String(name || 'report')
        .replace(/[^\w.-]+/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 60) || 'report';
}

async function writeAndShareBinary({
    title,
    bytes,
    filename,
    mimeType,
    minLength = 4,
    magicCheck,
}) {
    if (bytes.length < minLength) {
        throw new Error('Empty response from report export endpoint.');
    }
    if (typeof magicCheck === 'function' && !magicCheck(bytes)) {
        throw new Error('Server did not return a valid export file. Please try again.');
    }

    const path = `${RNFS.CachesDirectoryPath}/${filename}`;
    const base64 = arrayBufferToBase64(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    await RNFS.writeFile(path, base64, 'base64');
    const fileUrl = Platform.OS === 'ios' ? path : `file://${path}`;

    await RNShare.open({
        title: `${title} report`,
        url: fileUrl,
        type: mimeType,
        filename,
        failOnCancel: false,
    });
}

function buildExportPayload({ title, dateRangeLabel, cards, rows, companyName }) {
    return {
        title,
        dateRangeLabel,
        cards,
        rows,
        companyName,
    };
}

/**
 * Download a server-generated PDF and open the native share sheet.
 */
export async function shareReportPdfFromServer({
    title,
    dateRangeLabel,
    cards,
    rows,
    companyName,
}) {
    const { dashboard: dashboardApi } = await import('../services/api');
    const data = await dashboardApi.exportReportPdf(
        buildExportPayload({ title, dateRangeLabel, cards, rows, companyName }),
    );
    const bytes = toUint8Array(data);
    const dateStr = new Date().toISOString().slice(0, 10);
    const base = sanitizeFileBase(`${title}_${dateStr}`);
    await writeAndShareBinary({
        title,
        bytes,
        filename: `${base}.pdf`,
        mimeType: 'application/pdf',
        minLength: 5,
        magicCheck: (b) =>
            String.fromCharCode(b[0], b[1], b[2], b[3]) === '%PDF',
    });
}

/**
 * Download a server-generated Excel workbook and open the native share sheet.
 */
export async function shareReportExcelFromServer({
    title,
    dateRangeLabel,
    cards,
    rows,
    companyName,
}) {
    const { dashboard: dashboardApi } = await import('../services/api');
    const data = await dashboardApi.exportReportExcel(
        buildExportPayload({ title, dateRangeLabel, cards, rows, companyName }),
    );
    const bytes = toUint8Array(data);
    const dateStr = new Date().toISOString().slice(0, 10);
    const base = sanitizeFileBase(`${title}_${dateStr}`);
    await writeAndShareBinary({
        title,
        bytes,
        filename: `${base}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        minLength: 4,
        // ZIP/OOXML magic: PK..
        magicCheck: (b) => b[0] === 0x50 && b[1] === 0x4b,
    });
}

function humanizeKey(key) {
    return String(key || '')
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapeCsvCell(value) {
    if (value == null) return '';
    const string = String(value);
    if (/[",\n\r]/.test(string)) {
        return `"${string.replace(/"/g, '""')}"`;
    }
    return string;
}

/**
 * Build a UTF-8 CSV (with BOM) that Excel opens cleanly.
 */
export function buildReportCsvContent({ title, dateRangeLabel, cards, rows, companyName }) {
    const detailRows = Array.isArray(rows) ? rows : [];
    const columns =
        detailRows.length > 0
            ? Object.keys(detailRows[0]).filter((k) => k !== '_raw' && k !== 'id')
            : [];
    const lines = [];

    lines.push(['Shopynn Report'].map(escapeCsvCell).join(','));
    lines.push(['Company', companyName || 'Shopynn'].map(escapeCsvCell).join(','));
    lines.push(['Report', title || 'Report'].map(escapeCsvCell).join(','));
    lines.push(['Period', dateRangeLabel || 'All time'].map(escapeCsvCell).join(','));
    lines.push(['Exported', new Date().toLocaleString('en-GB')].map(escapeCsvCell).join(','));
    lines.push('');

    if (Array.isArray(cards) && cards.length) {
        lines.push(['Summary'].map(escapeCsvCell).join(','));
        lines.push(['Metric', 'Value'].map(escapeCsvCell).join(','));
        cards.forEach((c) => {
            lines.push([c.label || 'Metric', c.value ?? ''].map(escapeCsvCell).join(','));
        });
        lines.push('');
    }

    lines.push(['Details'].map(escapeCsvCell).join(','));
    if (columns.length) {
        lines.push(columns.map(humanizeKey).map(escapeCsvCell).join(','));
        detailRows.forEach((row) => {
            lines.push(columns.map((key) => escapeCsvCell(row?.[key])).join(','));
        });
    } else {
        lines.push(escapeCsvCell('No detail rows for this period.'));
    }

    // BOM helps Excel detect UTF-8 (currency symbols, accents)
    return `\uFEFF${lines.join('\n')}`;
}

/**
 * Write CSV to cache and share as a file (not raw text in the share message).
 */
export async function shareReportCsvFile({ title, csvContent }) {
    const dateStr = new Date().toISOString().slice(0, 10);
    const base = sanitizeFileBase(`${title}_${dateStr}`);
    const filename = `${base}.csv`;
    const path = `${RNFS.CachesDirectoryPath}/${filename}`;
    await RNFS.writeFile(path, csvContent, 'utf8');
    const fileUrl = Platform.OS === 'ios' ? path : `file://${path}`;

    await RNShare.open({
        title: `${title} export`,
        url: fileUrl,
        type: 'text/csv',
        filename,
        failOnCancel: false,
    });
}

export function alertExportError(error) {
    const msg =
        error?.response?.data?.message ||
        error?.message ||
        'Could not export report. Please try again.';
    Alert.alert('Export failed', typeof msg === 'string' ? msg : 'Could not export report. Please try again.');
}
