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
			Demo shop — anyone can explore and edit; data resets nightly. MoMo and withdrawals are disabled here.
		</Alert>
	);
}
