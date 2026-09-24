import {
    SECURE_PENDING_SALES_KEY as PENDING_SALES_KEY,
    readSecureList,
    writeSecureList,
} from './secureOfflineStorage';
import { sales as salesApi } from '../services/api';

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

/**
 * Upload all pending sales FIFO. Safe to call from NetInfo / AppState / Pending Sales screen.
 * @returns {{ uploaded: number, remaining: number }}
 */
export async function syncPendingSales() {
    const list = await readSecureList(PENDING_SALES_KEY);
    if (!Array.isArray(list) || list.length === 0) {
        return { uploaded: 0, remaining: 0 };
    }

    const stillPending = [];
    const nowIso = new Date().toISOString();
    let uploaded = 0;

    for (const item of list) {
        try {
            await salesApi.create(item.payload);
            uploaded += 1;
        } catch (err) {
            stillPending.push({
                ...item,
                attempts: (Number(item?.attempts) || 0) + 1,
                last_attempt_at: nowIso,
                last_error_code: getErrorCode(err) || item?.last_error_code || null,
                last_error_message: getErrorMessage(err) || item?.last_error_message || null,
            });
        }
    }

    await writeSecureList(PENDING_SALES_KEY, stillPending);
    return { uploaded, remaining: stillPending.length };
}

export default { syncPendingSales };
