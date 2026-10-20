import {
    SECURE_PENDING_SALES_KEY as PENDING_SALES_KEY,
    readSecureList,
    writeSecureList,
} from './secureOfflineStorage';
import { DeviceEventEmitter } from 'react-native';
import { sales as salesApi } from '../services/api';
import { SALES_LIST_REFRESH_EVENT } from './salesEvents';

const safeString = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const getErrorCode = (err) =>
    safeString(err?.response?.data?.code || err?.response?.data?.error?.code || err?.response?.data?.data?.code).toUpperCase();
const getErrorMessage = (err) =>
    safeString(
        err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            'Upload failed.'
    );

// A pending sale must never be uploaded twice at once: the server would save it again under the next invoice number.
const inFlightIds = new Set();
let runningSync = null;

export function claimPendingSale(id) {
    if (inFlightIds.has(id)) return false;
    inFlightIds.add(id);
    return true;
}

export function releasePendingSale(id) {
    inFlightIds.delete(id);
}

async function uploadPendingSales() {
    const list = await readSecureList(PENDING_SALES_KEY);
    if (!Array.isArray(list) || list.length === 0) {
        return { uploaded: 0, remaining: 0 };
    }

    const nowIso = new Date().toISOString();
    const uploadedIds = new Set();
    const failures = new Map();

    for (const item of list) {
        if (!claimPendingSale(item?.id)) continue;
        try {
            await salesApi.create(item.payload);
            uploadedIds.add(item?.id);
        } catch (err) {
            failures.set(item?.id, {
                attempts: (Number(item?.attempts) || 0) + 1,
                last_attempt_at: nowIso,
                last_error_code: getErrorCode(err) || item?.last_error_code || null,
                last_error_message: getErrorMessage(err) || item?.last_error_message || null,
            });
        } finally {
            releasePendingSale(item?.id);
        }
    }

    // Re-read so sales queued while uploading are kept.
    const current = await readSecureList(PENDING_SALES_KEY);
    const stillPending = (Array.isArray(current) ? current : [])
        .filter((i) => !uploadedIds.has(i?.id))
        .map((i) => (failures.has(i?.id) ? { ...i, ...failures.get(i?.id) } : i));

    await writeSecureList(PENDING_SALES_KEY, stillPending);
    if (uploadedIds.size > 0) DeviceEventEmitter.emit(SALES_LIST_REFRESH_EVENT);
    return { uploaded: uploadedIds.size, remaining: stillPending.length };
}

/**
 * Upload all pending sales FIFO. Safe to call from NetInfo / AppState / Pending Sales screen;
 * concurrent calls share one run.
 * @returns {Promise<{ uploaded: number, remaining: number }>}
 */
export function syncPendingSales() {
    if (!runningSync) {
        runningSync = uploadPendingSales().finally(() => {
            runningSync = null;
        });
    }
    return runningSync;
}

export default { syncPendingSales };
