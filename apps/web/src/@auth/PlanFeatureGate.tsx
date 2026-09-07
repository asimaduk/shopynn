'use client';

import PermissionGate from './PermissionGate';
import FeatureUpgradePrompt from 'src/app/(control-panel)/parity/FeatureUpgradePrompt';
import FeatureUnavailable from 'src/app/(control-panel)/parity/FeatureUnavailable';
import { getUpgradePromptProps } from 'src/configs/featureUpgradeContent';
import { FeatureFlagKey } from 'src/configs/featureFlags';

type PlanFeatureGateProps = {
	requiredPermissions?: string[] | string;
	requiredFeatures?: string[] | string;
	featureFlag?: FeatureFlagKey;
	backHref?: string;
	featureTitle?: string;
	children: React.ReactNode;
};

/**
 * Page-level gate: permission denied → unavailable message; plan denied → upgrade prompt.
 */
export default function PlanFeatureGate({
	requiredPermissions,
	requiredFeatures,
	featureFlag,
	backHref = '/dashboards/analytics',
	featureTitle,
	children
}: PlanFeatureGateProps) {
	const features = Array.isArray(requiredFeatures)
		? requiredFeatures
		: requiredFeatures
			? [requiredFeatures]
			: [];

	const upgradeProps = getUpgradePromptProps(
		features.length ? features : normalizeList(requiredPermissions),
		{ backHref }
	);
	if (featureTitle) upgradeProps.featureTitle = featureTitle;

	return (
		<PermissionGate
			requiredPermissions={requiredPermissions}
			requiredFeatures={requiredFeatures}
			featureFlag={featureFlag}
			planFallback={<FeatureUpgradePrompt {...upgradeProps} backHref={backHref} />}
			permissionFallback={
				<FeatureUnavailable
					title={featureTitle || upgradeProps.featureTitle}
					message="You do not have permission to access this area. Ask your account administrator."
				/>
			}
		>
			{children}
		</PermissionGate>
	);
}

function normalizeList(raw?: string[] | string): string[] {
	if (!raw) return [];
	return (Array.isArray(raw) ? raw : [raw]).map((c) => String(c).trim().toLowerCase()).filter(Boolean);
}
