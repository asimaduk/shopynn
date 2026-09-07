import type { AppDispatch } from '@/store/store';
import { setPendingSales } from './pendingSalesSlice';
import { showMessage } from '@fuse/core/FuseMessage/fuseMessageSlice';

function safeString(v: any): string {
	if (typeof v === 'string') return v;
	if (v == null) return '';
	return String(v);
}

function getErrorCode(err: any): string {
	return safeString(err?.response?.data?.code || err?.response?.data?.error?.code || err?.response?.data?.data?.code).toUpperCase();
}

function getErrorMessage(err: any): string {
	return safeString(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Upload failed.');
}

type CreateSale = (payload: any) => PromiseLike<any>;

/**
 * Upload each pending sale in order; removes successes from the list.
 * Matches the manual "Upload" flow in PendingsHeader.
 */
export async function uploadAllPendingSales(
	pendingSales: any[],
	createSale: CreateSale,
	dispatch: AppDispatch
): Promise<void> {
	if (!pendingSales.length) return;
	const nowIso = new Date().toISOString();

	try {
		const stillPending: any[] = [];

		for (const item of pendingSales) {
			const record = item?.payload ? item : { id: item?.id ?? Date.now(), payload: item };

			try {
				const res: any = await createSale(record.payload);
				if (!res?.data) {
					stillPending.push({
						...record,
						attempts: Number(record?.attempts ?? 0) + 1,
						last_attempt_at: nowIso,
						last_error_code: record?.last_error_code ?? 'UNKNOWN',
						last_error_message: record?.last_error_message ?? 'Upload failed.'
					});
				}
			} catch (err) {
				stillPending.push({
					...record,
					attempts: Number(record?.attempts ?? 0) + 1,
					last_attempt_at: nowIso,
					last_error_code: getErrorCode(err) || record?.last_error_code || null,
					last_error_message: getErrorMessage(err) || record?.last_error_message || null
				});
			}
		}

		dispatch(setPendingSales(stillPending));

		if (stillPending.length === 0) {
			dispatch(showMessage({ message: 'All pending sales have been uploaded successfully.', variant: 'success' }));
		}
	} catch (err: any) {
		dispatch(showMessage({ message: `Error uploading pending sales: ${err?.message || 'Unknown error'}`, variant: 'error' }));
	}
}
