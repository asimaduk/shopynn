'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Link from 'next/link';
import useUser from '@auth/useUser';
import { canManageSubscription } from '@auth/permissions';

type Props = {
	featureTitle?: string;
	requiredPlanName?: string;
	description?: string;
	bullets?: string[];
	currentPlanName?: string;
	backHref?: string;
	backLabel?: string;
};

export default function FeatureUpgradePrompt({
	featureTitle = 'This feature',
	requiredPlanName = 'Premium',
	description,
	bullets = [],
	currentPlanName,
	backHref = '/dashboards/analytics',
	backLabel = 'Go back'
}: Props) {
	const { data: user } = useUser();
	const canUpgrade = canManageSubscription(user);

	const resolvedPlanName =
		currentPlanName ??
		user?.company?.plan_usage?.tierDisplay ??
		user?.company?.subscription?.name ??
		user?.subscription?.name;

	const defaultDescription =
		description ||
		`${featureTitle} is included on the ${requiredPlanName} plan. Upgrade to unlock it for your business.`;

	return (
		<Box className="flex min-h-[60vh] w-full flex-col items-center px-6 py-12 md:px-12">
			<Box
				className="mb-5 flex h-20 w-20 items-center justify-center rounded-full"
				sx={{ bgcolor: 'primary.light', color: 'primary.main' }}
			>
				<FuseSvgIcon size={36}>heroicons-outline:lock-closed</FuseSvgIcon>
			</Box>
			<Typography variant="h5" className="text-center font-semibold">
				{requiredPlanName} plan required
			</Typography>
			<Typography color="text.secondary" className="mt-3 max-w-lg text-center">
				{defaultDescription}
			</Typography>
			{resolvedPlanName ? (
				<Paper variant="outlined" className="mt-6 w-full max-w-md p-4 text-center">
					<Typography variant="caption" color="text.secondary">
						Your current plan
					</Typography>
					<Typography className="mt-1 font-semibold">{resolvedPlanName}</Typography>
				</Paper>
			) : null}
			{bullets.length > 0 ? (
				<Paper variant="outlined" className="mt-4 w-full max-w-md p-4">
					{bullets.map((line) => (
						<Box key={line} className="mb-2 flex items-start gap-2 last:mb-0">
							<FuseSvgIcon size={18} color="primary">
								heroicons-outline:check
							</FuseSvgIcon>
							<Typography variant="body2" color="text.secondary">
								{line}
							</Typography>
						</Box>
					))}
				</Paper>
			) : null}
			<Box className="mt-8 flex w-full max-w-md flex-col gap-3">
				{canUpgrade ? (
					<Button component={Link} href="/apps/profile?scroll=plans" variant="contained" color="primary" fullWidth>
						View {requiredPlanName} plan
					</Button>
				) : (
					<Typography variant="body2" color="text.secondary" className="text-center">
						Ask your account owner or administrator to upgrade the subscription.
					</Typography>
				)}
				<Button component={Link} href={backHref} variant="text" color="primary" fullWidth>
					{backLabel}
				</Button>
			</Box>
		</Box>
	);
}
