'use client';

import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';

/**
 * Sticky banner when the browser reports no network. New Sale and other flows can keep using cached RTK data.
 */
export default function OfflineBanner() {
	const [offline, setOffline] = useState(
		() => typeof navigator !== 'undefined' && !navigator.onLine
	);

	useEffect(() => {
		const on = () => setOffline(false);
		const off = () => setOffline(true);
		window.addEventListener('online', on);
		window.addEventListener('offline', off);
		setOffline(!navigator.onLine);
		return () => {
			window.removeEventListener('online', on);
			window.removeEventListener('offline', off);
		};
	}, []);

	if (!offline) return null;

	return (
		<Alert
			severity="warning"
			variant="filled"
			icon={<FuseSvgIcon size={22}>heroicons-outline:wifi</FuseSvgIcon>}
			sx={{
				position: 'sticky',
				top: 0,
				zIndex: (theme) => theme.zIndex.drawer + 2,
				borderRadius: 0,
				justifyContent: 'center',
				'& .MuiAlert-message': { fontWeight: 600 }
			}}
		>
			You’re offline — POS can use the last saved product catalog. Sales will queue until you reconnect.
		</Alert>
	);
}
