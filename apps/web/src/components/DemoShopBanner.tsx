'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import useUser from '@auth/useUser';
import { marketingSiteUrl } from '@/@auth/signOutUrl';

/**
 * Persistent notice when signed into the shared Shopynn Demo Store.
 */
export default function DemoShopBanner() {
	const { signOut, isGuest, isDemo } = useUser();

	if (isGuest || !isDemo) return null;

	return (
		<Alert
			severity="info"
			className="rounded-none"
			sx={{
				py: 0.5,
				'& .MuiAlert-message': { py: 0.75, fontSize: '0.8125rem' },
				'& .MuiAlert-action': { pt: 0.25, alignItems: 'center' }
			}}
			action={
				<>
					<Button color="inherit" size="small" href={marketingSiteUrl('/start-trial')}>
						Start free
					</Button>
					<Button color="inherit" size="small" onClick={() => signOut()}>
						Sign out
					</Button>
				</>
			}
		>
			Live demo — explore sales and stock; data resets nightly. Uploads, staff admin, MoMo, and withdrawals are
			disabled.
		</Alert>
	);
}
