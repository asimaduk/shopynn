'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import FeatureUpgradePrompt from '../parity/FeatureUpgradePrompt';
import { getUpgradePromptProps } from 'src/configs/featureUpgradeContent';

export default function UpgradePage() {
	const searchParams = useSearchParams();
	const featuresParam = searchParams.get('features') || '';
	const returnUrl = searchParams.get('return') || '/dashboards/analytics';

	const featureCodes = useMemo(
		() =>
			featuresParam
				.split(',')
				.map((f) => f.trim().toLowerCase())
				.filter(Boolean),
		[featuresParam]
	);

	const prompt = useMemo(
		() => getUpgradePromptProps(featureCodes.length ? featureCodes : ['reports.view'], { backHref: returnUrl }),
		[featureCodes, returnUrl]
	);

	return <FeatureUpgradePrompt {...prompt} backHref={returnUrl} />;
}
