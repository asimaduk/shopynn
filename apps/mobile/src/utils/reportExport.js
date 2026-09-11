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

function sanitizeFileBase(name) {
    return String(name || 'report')
        .replace(/[^\w.-]+/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 60) || 'report';
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
    const data = await dashboardApi.exportReportPdf({
        title,
        dateRangeLabel,
        cards,
        rows,
        companyName,
    });
    const bytes =
        data instanceof ArrayBuffer
            ? new Uint8Array(data)
            : data?.buffer
              ? new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength || data.length)
              : new Uint8Array(data || []);
    if (bytes.length < 5) {
        throw new Error('Empty response from report PDF endpoint.');
    }
    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (magic !== '%PDF') {
        throw new Error('Server did not return a PDF file. Please try again.');
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const base = sanitizeFileBase(`${title}_${dateStr}`);
    const filename = `${base}.pdf`;
    const path = `${RNFS.CachesDirectoryPath}/${filename}`;
    const base64 = arrayBufferToBase64(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    await RNFS.writeFile(path, base64, 'base64');
    const fileUrl = Platform.OS === 'ios' ? path : `file://${path}`;

    await RNShare.open({
        title: `${title} report`,
        url: fileUrl,
        type: 'application/pdf',
        filename,
        failOnCancel: false,
    });
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
    Alert.alert('Export failed', msg);
}
