export type FeatureFlagKey =
	| 'purchaseOrders'
	| 'receiptSettings'
	| 'dataExportBackup';

function toBool(value: string | undefined, fallback = false): boolean {
	if (!value) return fallback;
	return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
}

export const featureFlags: Record<FeatureFlagKey, boolean> = {
	purchaseOrders: toBool(process.env.NEXT_PUBLIC_FEATURE_PURCHASE_ORDERS, false),
	receiptSettings: toBool(process.env.NEXT_PUBLIC_FEATURE_RECEIPT_SETTINGS, true),
	dataExportBackup: toBool(process.env.NEXT_PUBLIC_FEATURE_DATA_EXPORT, false)
};

export function isFeatureEnabled(flag?: FeatureFlagKey): boolean {
	if (!flag) return true;
	return Boolean(featureFlags[flag]);
}
